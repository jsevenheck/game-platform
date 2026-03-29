import { defineConfig } from 'vitest/config';
import { allProjects } from './vitest.projects';

export default defineConfig({
  test: {
    projects: allProjects,
  },
});
