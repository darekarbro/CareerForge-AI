# Pre-execution semantic label review

This is an independent **agent review**, not a human review or an externally validated benchmark. The reviewer read only `holdout.json` and `AUTHORING.md`, plus the annotation policy supplied in the task. The reviewer did not access implementation, prior fixtures, tests, protocol runners, predictions, or results, and did not run or import application, parsing, matching, or evaluation code. File-reading and text-search tools were used only to inspect the two authorized documents.

Review outcome: **approved before first model execution**. All 24 reference cases are defensible under the supplied semantic policy. No pre-execution label or text corrections were requested or made. The reviewer did not edit `holdout.json`. This review assigns no human overall fit scores.

For every ID below, the review checked the candidate name and email, the complete set of explicit positive canonical skills (including positives outside the JD), all explicit required/preferred JD labels and categories, and evidence status. Candidate-positive assertions plus direct candidate denials are withheld from positive extraction and marked uncertain when requested. Denial-only evidence is missing. Aspirations, instructions, and third-party statements do not establish candidate skills. Incidental names, organizations, titles, and unrelated negation do not add or cancel skills. The supplied ReactJS/React.js, Nodejs, Postgres, Golang, and RESTful APIs aliases were applied.

| Case ID | Contact identity checked | Semantic review finding |
| --- | --- | --- |
| fresh-format-01 | Marin Vell; marin.vell@example.test | Python, FastAPI, PostgreSQL, Git, Docker are positive; AWS is absent. |
| fresh-format-02 | Elodie Senn; elodie.senn@example.test | TypeScript, React, HTML, CSS are positive; Accessibility and Jest are absent. |
| fresh-format-03 | Tomas Ivero; tomas.ivero@example.test | Java, Spring Boot, SQL, MySQL, Linux are positive despite columns; PostgreSQL is absent. |
| fresh-format-04 | Nuri Talven; nuri.talven@example.test | Go, REST API, Redis, Docker, Kubernetes are positive with aliases normalized; Kafka is absent. |
| fresh-format-05 | Sera Odrin; sera.odrin@example.test | C++, C#, .NET, Algorithms, Data Structures are positive; Rust is absent. |
| fresh-format-06 | Olan Mirel; olan.mirel@example.test | React, Next.js, Node.js, MongoDB, GraphQL, Jest are positive; AWS is absent. |
| fresh-format-07 | Veda Corlen; veda.corlen@example.test | Ruby, Rails, PostgreSQL, CI/CD, Git are positive; Docker is absent. |
| fresh-format-08 | Iona Pell Varo; iona.pell.varo@example.test | PHP, Laravel, SQL, MySQL, Tailwind, CSS are positive across wrapped lines; Kubernetes is absent. |
| fresh-format-09 | Ines Dorren; ines.dorren@example.test | Python, Pandas, Machine Learning, Scikit-Learn are positive; TensorFlow is an aspiration with explicit present absence. |
| fresh-format-10 | Pavlo Nerin; pavlo.nerin@example.test | JavaScript, Node.js, Express, REST API, MongoDB are positive; Redis is absent. |
| fresh-format-11 | Keira Mossen; keira.mossen@example.test | HTML, CSS, Sass, Accessibility, Cypress, Git are positive in the text table; React is absent. |
| fresh-format-12 | Darian Solvek; darian.solvek@example.test | Rust, Linux, CI/CD, Leadership, Communication are positive; Kubernetes is absent. |
| fresh-conflict-01 | Alma Virett; alma.virett@example.test | Python is contradicted and uncertain; SQL and Docker remain positive; PostgreSQL is absent. |
| fresh-conflict-02 | Joren Fenn; joren.fenn@example.test | React is contradicted through ReactJS despite denial-first order; TypeScript and CSS remain positive; Jest is absent. |
| fresh-conflict-03 | Nessa Torval; nessa.torval@example.test | Node.js is contradicted through Nodejs; Express and REST API remain positive; MongoDB is absent. |
| fresh-conflict-04 | Petra Ilven; petra.ilven@example.test | Java and Spring Boot are each contradicted and uncertain; Linux and Git remain positive; AWS is absent. |
| fresh-conflict-05 | Solen Merrow; solen.merrow@example.test | PostgreSQL is contradicted through Postgres; Redis and Docker remain positive; MySQL is denial-only and missing. |
| fresh-conflict-06 | Mira Kelset; mira.kelset@example.test | Python and Pandas are positive; the TensorFlow quotation belongs to a colleague, so candidate denial gives missing rather than uncertain. |
| fresh-conflict-07 | Lior Avenk; lior.avenk@example.test | Go, Docker, Linux are positive; outage/catering negation is unrelated; Kubernetes is absent. |
| fresh-conflict-08 | Oren Westral; oren.westral@example.test | Rust is contradicted and uncertain; C++, Algorithms, Data Structures remain positive; Go is absent. |
| fresh-conflict-09 | Tessa Vorren; tessa.vorren@example.test | AWS is contradicted despite denial-first order; Terraform and CI/CD remain positive; Azure is absent. |
| fresh-conflict-10 | Celia Durnet; celia.durnet@example.test | Python, FastAPI, SQL are positive; quoted instructions do not claim candidate JavaScript/React skills, so their denials yield missing. |
| fresh-conflict-11 | Amir Velkin; amir.velkin@example.test | Machine Learning is contradicted and uncertain; PyTorch and Pandas remain positive; TensorFlow is absent. |
| fresh-conflict-12 | Esme Halven; esme.halven@example.test | React is contradicted through React.js; Redux, Jest, Accessibility remain positive; Redis is denial-only and missing; education negation is unrelated. |

The formatting group contains 12 cases spanning contact placement, capitalization, whitespace columns, punctuation, aliases, framed text, wrapping, tables, embedded identity, and skill lists/prose. The contradictory-skills group contains nine actual candidate conflicts and three documented controls (fresh-conflict-06, fresh-conflict-07, fresh-conflict-10). Conflict cases include both assertion orders, alias conflicts, multiple conflicted skills, and unaffected positives. This is adequate variety for the stated small synthetic scope; group membership does not imply that every control must contain an actual contradiction.

Limitations: review was semantic and agent-performed, with the supplied canonical labels and alias mapping; it does not establish external benchmark independence, human agreement, real-world prevalence, production quality, fairness, or general accuracy. All cases target Software Engineer and use fictional plain text, so results cannot establish other-role coverage, real document extraction quality, or multilingual robustness. Gold labels were approved without seeing model output; any later evaluation failure must not be used to relabel these cases merely to improve reported performance.
