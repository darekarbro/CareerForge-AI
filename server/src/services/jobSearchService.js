const JobSearchQuery = require('../models/JobSearchQuery');
const Resume = require('../models/Resume');

class JobSearchService {
  getSupportedRoles() {
    return [
      {
        id: 'sde',
        title: 'Software Development Engineer (SDE)',
        category: 'Engineering',
        description: 'Core algorithm design, data structures, and production backend services.',
        defaultKeywords: ['SDE', 'Software Engineer', 'Java', 'C++', 'Data Structures'],
      },
      {
        id: 'fullstack',
        title: 'Full Stack Engineer',
        category: 'Engineering',
        description: 'End-to-end web architectures, React/Next.js, Node.js, and databases.',
        defaultKeywords: ['Full Stack Developer', 'React', 'Node.js', 'TypeScript', 'Next.js'],
      },
      {
        id: 'backend',
        title: 'Backend Engineer',
        category: 'Engineering',
        description: 'High-throughput microservices, API architecture, caching, and SQL/NoSQL.',
        defaultKeywords: ['Backend Engineer', 'Node.js', 'PostgreSQL', 'Redis', 'Microservices'],
      },
      {
        id: 'frontend',
        title: 'Frontend Engineer',
        category: 'Engineering',
        description: 'Dynamic user experiences, web performance, component libraries, and CSS.',
        defaultKeywords: ['Frontend Engineer', 'React', 'Tailwind', 'Next.js', 'JavaScript'],
      },
      {
        id: 'data-ml',
        title: 'Data & Machine Learning Engineer',
        category: 'Data Science',
        description: 'Machine learning pipelines, predictive modeling, Python, and SQL analytics.',
        defaultKeywords: ['Machine Learning Engineer', 'Python', 'PyTorch', 'Data Science', 'SQL'],
      },
      {
        id: 'devops',
        title: 'DevOps & Cloud Engineer',
        category: 'Infrastructure',
        description: 'CI/CD automation, Kubernetes, Docker, Terraform, and cloud infrastructure.',
        defaultKeywords: ['DevOps Engineer', 'Kubernetes', 'Docker', 'AWS', 'CI/CD', 'Terraform'],
      },
      {
        id: 'product',
        title: 'Technical Product Manager',
        category: 'Product',
        description: 'Product lifecycle, roadmap execution, user analytics, and agile delivery.',
        defaultKeywords: ['Product Manager', 'Agile', 'Product Strategy', 'Roadmapping'],
      },
    ];
  }

  /**
   * Generates public search deep-links for LinkedIn, Internshala, Naukri, and Indeed
   */
  async generateSearchLinks({ userId, targetRole, resumeId, location = 'Remote' }) {
    let resumeSkills = [];

    if (resumeId) {
      const resume = await Resume.findOne({ _id: resumeId, owner: userId });
      if (resume && resume.parsedData?.skills?.all) {
        resumeSkills = resume.parsedData.skills.all.slice(0, 4);
      }
    }

    const roleClean = targetRole.trim();
    const queryKeywords = Array.from(new Set([roleClean, ...resumeSkills]));
    const queryString = encodeURIComponent(queryKeywords.join(' '));
    const locationEncoded = encodeURIComponent(location);

    // Build Deep-links for public search results
    const links = {
      linkedin: `https://www.linkedin.com/jobs/search/?keywords=${queryString}&location=${locationEncoded}&f_TPR=r604800`,
      internshala: `https://internshala.com/jobs/keywords-${encodeURIComponent(roleClean.toLowerCase().replace(/\s+/g, '-'))}/`,
      naukri: `https://www.naukri.com/${encodeURIComponent(roleClean.toLowerCase().replace(/\s+/g, '-'))}-jobs?k=${queryString}`,
      indeed: `https://www.indeed.com/jobs?q=${queryString}&l=${locationEncoded}`,
    };

    const record = await JobSearchQuery.create({
      owner: userId,
      targetRole: roleClean,
      location,
      generatedKeywords: queryKeywords,
      generatedLinks: links,
      resumeSkillsUsed: resumeSkills,
    });

    return {
      searchQuery: record,
      generatedKeywords: queryKeywords,
      links,
    };
  }
}

module.exports = new JobSearchService();
