// OpenAPI fragments for the Express routers in routes/.
// scripts/mergeOpenapi.js merges them into the tsoa-generated spec.
// Add one file per resource and list it here.
import components from './components.js';
import users from './users.js';
import projects from './projects.js';
import members from './members.js';
import folders from './folders.js';
import cases from './cases.js';
import tags from './tags.js';
import runs from './runs.js';
import comments from './comments.js';

export default [components, users, projects, members, folders, cases, tags, runs, comments];
