import path from 'path';

type ExistsSync = (targetPath: string) => boolean;

type ResolveStaticDirOptions = {
  rootDir: string;
  lifecycleEvent?: string;
  existsSync: ExistsSync;
};

type ResolveStaticDirResult = {
  builtClientDir: string;
  devClientDir: string;
  preferStandaloneWebDist: boolean;
  standaloneWebDist: string;
  staticDir: string;
};

function resolveStandaloneStaticDir({
  rootDir,
  lifecycleEvent = '',
  existsSync,
}: ResolveStaticDirOptions): ResolveStaticDirResult {
  const builtClientDir = path.join(rootDir, 'dist', 'client');
  const devClientDir = path.join(rootDir, 'ui-vue');
  const standaloneWebDist = path.join(rootDir, 'dist', 'standalone-web');
  const preferStandaloneWebDist = lifecycleEvent === 'start:standalone';

  let staticDir: string;
  if (preferStandaloneWebDist && existsSync(path.join(standaloneWebDist, 'index.html'))) {
    staticDir = standaloneWebDist;
  } else if (existsSync(path.join(builtClientDir, 'index.html'))) {
    staticDir = builtClientDir;
  } else if (existsSync(path.join(standaloneWebDist, 'index.html'))) {
    staticDir = standaloneWebDist;
  } else {
    staticDir = devClientDir;
  }

  return {
    builtClientDir,
    devClientDir,
    preferStandaloneWebDist,
    standaloneWebDist,
    staticDir,
  };
}

export { resolveStandaloneStaticDir };
export type { ResolveStaticDirOptions, ResolveStaticDirResult };
