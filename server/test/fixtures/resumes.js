const graduate = {
  contactInfo: { name: 'Avery Example', email: 'avery@example.test', phone: '+1 555 010 2000', location: 'Example City' },
  summary: 'Computer science graduate who built Python data validation and React course projects.',
  skills: { technical: ['Python', 'JavaScript'], frameworks: ['React'], tools: ['Git'], soft: ['Collaboration'], all: ['Python', 'JavaScript', 'React', 'Git', 'Collaboration'] },
  workExperience: [], education: [{ degree: 'BSc', institution: 'Example University', fieldOfStudy: 'Computer Science', graduationYear: '2025' }],
  projects: [{ title: 'Course Data Validator', description: 'Built a course project to validate CSV input and display issues before importing data.',
    technologies: ['Python', 'React'], link: 'https://example.test/validator', highlights: ['Wrote Python validation rules for missing fields and duplicate rows.', 'Built a React form that displays validation errors before submitting.'] }],
  certifications: [{ name: 'Example Python Course', issuer: 'Example Learning', year: '2025' }],
};
const experienced = { ...graduate, contactInfo: { ...graduate.contactInfo, name: 'Morgan Example' },
  summary: 'Backend engineer with experience building Python services, reviewing API contracts and maintaining data imports.',
  workExperience: Array.from({ length: 6 }, (_, index) => ({ role: 'Backend Engineer ' + (index + 1), company: 'Example Company ' + (index + 1), startDate: String(2018 + index), endDate: String(2019 + index),
    highlights: Array.from({ length: 5 }, (_item, bullet) => 'Implemented Python validation module ' + (bullet + 1) + ' for the data import workflow; documented API contracts, reviewed failure cases with the team, and added regression tests for malformed input.') })),
  projects: Array.from({ length: 4 }, (_, index) => ({ ...graduate.projects[0], title: 'Validation Project ' + (index + 1), description: graduate.projects[0].description + ' Documented how validation errors are returned to users and how failed imports can be retried.' })),
};
module.exports = { graduate, experienced };
