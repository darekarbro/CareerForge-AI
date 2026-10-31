const SKILLS = [
  'JavaScript', 'TypeScript', 'React', 'Next.js', 'Node.js', 'Express', 'Python', 'Django', 'FastAPI',
  'Java', 'Spring Boot', 'C++', 'C#', '.NET', 'Go', 'Rust', 'Ruby', 'Rails', 'PHP', 'Laravel',
  'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'GraphQL', 'REST API', 'Docker', 'Kubernetes',
  'AWS', 'GCP', 'Azure', 'CI/CD', 'Git', 'Linux', 'HTML', 'CSS', 'Tailwind', 'Sass', 'Redux',
  'Zustand', 'Jest', 'Cypress', 'Terraform', 'Kafka', 'Elasticsearch', 'PyTorch', 'TensorFlow',
  'Pandas', 'Scikit-Learn', 'Machine Learning', 'Data Pipelines', 'Algorithms', 'Data Structures',
  'System Design', 'Microservices', 'Accessibility', 'Agile', 'Scrum', 'Leadership', 'Communication',
  'Product Strategy', 'Roadmapping', 'A/B Testing', 'User Research', 'Figma',
];
const aliases = {
  'nodejs': 'node.js', 'node js': 'node.js', 'nextjs': 'next.js', 'next js': 'next.js',
  'reactjs': 'react', 'react.js': 'react', 'postgres': 'postgresql', 'golang': 'go',
  'rest apis': 'rest api', 'restful apis': 'rest api', 'restful api': 'rest api', 'tailwind css': 'tailwind',
};
const normalizeSkill = (value) => {
  const key = String(value).trim().toLowerCase();
  return aliases[key] || key;
};
const escape = (value) => value.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
const hasSkill = (text, skill) => {
  const forms = [skill, ...Object.keys(aliases).filter((key) => aliases[key] === normalizeSkill(skill))];
  return forms.some((form) => new RegExp('(?:^|[^a-z0-9_+#.])' + escape(form) + '(?=$|[^a-z0-9_+#])', 'i').test(String(text)));
};
const extractSkills = (text) => SKILLS.filter((skill) => hasSkill(text, skill));
const plain = (value) => value?.toObject ? value.toObject() : JSON.parse(JSON.stringify(value || {}));
const resumeLines = (data = {}) => {
  const lines = [];
  const visit = (value) => {
    if (typeof value === 'string' && value.trim()) lines.push(...value.split(/\r?\n/).filter(Boolean));
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') {
      Object.entries(value).filter(([key]) => !['_id', 'entryId', 'aiProvider', 'warnings'].includes(key)).forEach(([, item]) => visit(item));
    }
  };
  visit(plain(data));
  return lines;
};
const resumeText = (data) => resumeLines(data).join('\n');
const roleId = (role = '') => {
  const text = role.toLowerCase().replace(/\s+/g, '');
  if (/data|machinelearning|mlengineer/.test(text)) return 'data';
  if (/devops|cloud|infrastructure/.test(text)) return 'devops';
  if (/product/.test(text)) return 'product';
  if (/backend/.test(text)) return 'backend';
  if (/frontend/.test(text)) return 'frontend';
  if (/sde|softwaredevelopmentengineer/.test(text)) return 'sde';
  return 'fullstack';
};
const ROLE_SKILLS = {
  sde: ['Algorithms', 'Data Structures', 'Java', 'C++', 'System Design'],
  backend: ['Node.js', 'Python', 'SQL', 'PostgreSQL', 'Redis', 'Microservices', 'GraphQL'],
  frontend: ['React', 'Next.js', 'TypeScript', 'CSS', 'Accessibility', 'Jest'],
  fullstack: ['React', 'Node.js', 'TypeScript', 'SQL', 'REST API'],
  data: ['Python', 'PyTorch', 'TensorFlow', 'Pandas', 'SQL', 'Machine Learning'],
  devops: ['Docker', 'Kubernetes', 'Terraform', 'AWS', 'CI/CD', 'Linux'],
  product: ['Product Strategy', 'Roadmapping', 'Agile', 'A/B Testing', 'User Research'],
};
module.exports = { SKILLS, normalizeSkill, hasSkill, extractSkills, plain, resumeLines, resumeText, roleId, ROLE_SKILLS };
