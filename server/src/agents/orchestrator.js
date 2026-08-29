const ProcessingJob = require('../models/ProcessingJob');
const Notification = require('../models/Notification');
const parserAgent = require('./parserAgent');
const analyzerAgent = require('./analyzerAgent');
const generatorAgent = require('./generatorAgent');
const evaluatorAgent = require('./evaluatorAgent');
const recoveryAgent = require('./recoveryAgent');
const monitoringAgent = require('./monitoringAgent');
const { emitNotification } = require('../config/socket');

class Orchestrator {
  /**
   * Run a pipeline job
   */
  async runJob(jobId) {
    const job = await ProcessingJob.findById(jobId);
    if (!job) {
      throw new Error(`ProcessingJob with ID ${jobId} not found`);
    }

    if (job.status === 'CANCELLED') {
      return job;
    }

    job.status = 'RUNNING';
    job.startedAt = new Date();
    await job.save();

    const startTime = Date.now();
    const userId = job.owner;

    await monitoringAgent.logEvent({
      jobId: job._id,
      userId,
      agent: 'orchestrator',
      level: 'info',
      message: `Orchestrator began execution for job type: ${job.jobType}`,
      step: 'job_started',
    });

    try {
      let output = null;

      switch (job.jobType) {
        case 'resume_parse': {
          job.currentAgent = 'parser';
          await job.save();

          const { fileBuffer, rawText, fileType } = job.inputRef.rawInput || {};
          const parseResult = await parserAgent.parse({
            fileBuffer: fileBuffer ? Buffer.from(fileBuffer, 'base64') : null,
            rawText,
            fileType,
            jobId: job._id,
            userId,
          });

          // Also run initial ATS score
          job.currentAgent = 'analyzer';
          await job.save();

          const atsResult = await analyzerAgent.scoreATS({
            resumeData: parseResult.parsedData,
            rawText: parseResult.rawText,
            jobId: job._id,
            userId,
          });

          output = {
            rawText: parseResult.rawText,
            parsedData: parseResult.parsedData,
            atsScore: atsResult,
            aiProvider: parseResult.aiProvider,
          };
          break;
        }

        case 'resume_tailor': {
          job.currentAgent = 'generator';
          await job.save();

          const { resumeData, targetRole, jobDescriptionText } = job.inputRef.rawInput || {};
          const tailorResult = await generatorAgent.tailorResume({
            resumeData,
            targetRole,
            jobDescriptionText,
            jobId: job._id,
            userId,
          });

          // Score tailored ATS
          job.currentAgent = 'analyzer';
          await job.save();

          const tailoredAts = await analyzerAgent.scoreATS({
            resumeData: tailorResult,
            rawText: '',
            jobId: job._id,
            userId,
          });

          output = {
            ...tailorResult,
            atsScore: tailoredAts,
          };
          break;
        }

        case 'gap_analysis': {
          job.currentAgent = 'analyzer';
          await job.save();

          const { resumeData, jobDescriptionText, targetRole } = job.inputRef.rawInput || {};
          output = await analyzerAgent.analyzeGap({
            resumeData,
            jobDescriptionText,
            targetRole,
            jobId: job._id,
            userId,
          });
          break;
        }

        case 'ats_score': {
          job.currentAgent = 'analyzer';
          await job.save();

          const { resumeData, rawText } = job.inputRef.rawInput || {};
          output = await analyzerAgent.scoreATS({
            resumeData,
            rawText,
            jobId: job._id,
            userId,
          });
          break;
        }

        case 'question_generation': {
          job.currentAgent = 'generator';
          await job.save();

          const { resumeData, targetRole, jobDescriptionText, count } = job.inputRef.rawInput || {};
          output = await generatorAgent.generateQuestions({
            resumeData,
            targetRole,
            jobDescriptionText,
            count,
            jobId: job._id,
            userId,
          });
          break;
        }

        case 'answer_evaluation': {
          job.currentAgent = 'evaluator';
          await job.save();

          const { question, userAnswer, suggestedAnswer, targetRole } = job.inputRef.rawInput || {};
          output = await evaluatorAgent.evaluateAnswer({
            question,
            userAnswer,
            suggestedAnswer,
            targetRole,
            jobId: job._id,
            userId,
          });
          break;
        }

        default:
          throw new Error(`Unsupported jobType: ${job.jobType}`);
      }

      job.status = 'COMPLETED';
      job.output = output;
      job.durationMs = Date.now() - startTime;
      job.completedAt = new Date();
      await job.save();

      await monitoringAgent.logEvent({
        jobId: job._id,
        userId,
        agent: 'orchestrator',
        level: 'success',
        message: `Pipeline job [${job.jobType}] completed successfully in ${job.durationMs}ms`,
        step: 'job_completed',
        durationMs: job.durationMs,
      });

      // Create & emit persistent notification
      const notification = await Notification.create({
        owner: userId,
        jobId: job._id,
        type: 'job_completed',
        title: `Job Completed: ${job.jobType.replace('_', ' ').toUpperCase()}`,
        message: `Your background AI request has finished processing successfully.`,
      });
      emitNotification(userId, notification);

      return job;
    } catch (error) {
      const recovery = await recoveryAgent.handleFailure({
        jobId: job._id,
        userId,
        agent: job.currentAgent || 'orchestrator',
        error,
        retryCount: job.retryCount,
      });

      if (recovery.shouldRetry) {
        job.status = 'RETRYING';
        job.retryCount += 1;
        await job.save();
        
        // Wait delay and retry
        await new Promise(resolve => setTimeout(resolve, recovery.delayMs));
        return this.runJob(jobId);
      }

      job.status = 'FAILED';
      job.error = {
        code: recovery.classification?.class || 'JOB_FAILURE',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        agent: job.currentAgent,
      };
      job.durationMs = Date.now() - startTime;
      job.completedAt = new Date();
      await job.save();

      const notif = await Notification.create({
        owner: userId,
        jobId: job._id,
        type: 'job_failed',
        title: `Job Failed: ${job.jobType.replace('_', ' ').toUpperCase()}`,
        message: recovery.classification?.reason || error.message,
      });
      emitNotification(userId, notif);

      throw error;
    }
  }
}

module.exports = new Orchestrator();
