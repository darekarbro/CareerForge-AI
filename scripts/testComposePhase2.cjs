const assert = require('node:assert/strict');
module.exports = async ({ request, finished, resumeId }) => {
  const original = (await request('GET', '/resumes/' + resumeId + '/import-review')).data;
  assert(original.sourceText.includes('Container Candidate'));
  const content = { contactInfo: { name: 'Zoë García · ओम दरेकर · 李明', email: 'fictional@example.test' }, summary: 'Built Python validation for course data imports.', skills: { technical: ['Python'], tools: ['Git'] },
    projects: [{ entryId: 'container-project', title: 'Container validation', description: 'I wrote Python input validation.', technologies: ['Python'], highlights: ['Tested malformed input.'] }] };
  await request('PUT', '/profile', { revision: 0, revisionName: 'Verified international profile', content, experienceLevel: 'changer', targetRole: 'Engineer', onboardingCompleted: true });
  const created = (await request('POST', '/profile/resumes', { title: 'Container Phase 2 resume' }, 201)).data;
  const body = { company: 'Container Target', title: 'Engineer', description: 'Python input validation required.', resumeId: created._id, resumeSelection: { projects: ['container-project'], workExperience: [] } };
  const workspace = (await request('POST', '/workspaces', body, 201)).data;
  assert.equal((await request('POST', '/workspaces', body, 409)).code, 'DUPLICATE_WORKSPACE');
  const job = (await request('POST', '/workspaces/' + workspace._id + '/tailor', {}, 202)).data;
  const version = (await finished(job.jobId)).output.tailoredResume, url = '/resumes/' + created._id + '/versions/' + version._id;
  await request('PUT', url, { revision: 1, revisionName: 'Reviewed container draft', content: version.tailoredContent, decisions: { summary: 'accepted' } });
  await request('PUT', url + '/layout', { revision: 1, settings: { template: 'modern', font: 'serif', pageBreakBefore: ['projects'] } });
  const pdf = await request('GET', '/resumes/' + created._id + '/download/' + version._id + '?preview=1');
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF'); assert.match(pdf.toString('latin1'), /\/FontFile[23]/);
  assert.equal((await request('GET', url)).data.exportSettings.template, 'modern');
  assert.equal((await request('GET', url + '/history')).data.at(-1).name, 'Reviewed container draft');
  await request('PUT', '/workspaces/' + workspace._id + '/preparation', { revision: 1, preparation: { researchedCompany: true } });
  await request('POST', '/workspaces/' + workspace._id + '/archive', { revision: 2 });
  assert.equal((await request('GET', '/workspaces')).data.length, 0);
  await request('POST', '/workspaces/' + workspace._id + '/restore', { revision: 3 });
  assert.equal((await request('GET', '/workspaces/' + workspace._id)).data.preparation.find((step) => step.key === 'researchedCompany').done, true);
  console.log('PASS Phase 2 profile history, selection, duplicate jobs, checklist, archive/restore and embedded Unicode PDF in separate containers');
};
