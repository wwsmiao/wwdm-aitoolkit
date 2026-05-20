import path from 'path';

// TOOLKIT_ROOT is the project root containing ui/, toolkit/, output/, etc.
// Next.js always sets process.cwd() to the app directory (ui/), so .. reaches the toolkit root.
export const TOOLKIT_ROOT = path.resolve(process.cwd(), '..');
export const defaultTrainFolder = path.join(TOOLKIT_ROOT, 'output');
export const defaultDatasetsFolder = path.join(TOOLKIT_ROOT, 'datasets');
export const defaultDataRoot = path.join(TOOLKIT_ROOT, 'data');
