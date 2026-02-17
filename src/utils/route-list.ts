// DEBUG: safe, robust route lister — paste right after mounting the tsoaRouter
const prettyListRoutes = (app: any, mountedRouter?: any, mountPath = '/api') => {
  const out: string[] = [];

  // Helper to safely iterate a stack (handles many shapes)
  const safeStack = (obj: any) => (obj && Array.isArray(obj.stack) ? obj.stack : Array.isArray(obj) ? obj : []);

  // 1) Inspect top-level app stack
  const top = app && app._router ? safeStack(app._router) : [];
  out.push(`app._router.stack length: ${top.length}`);

  // 2) Inspect router you mounted (if provided)
  if (mountedRouter) {
    const rstack = safeStack(mountedRouter);
    out.push(`mounted router.stack length: ${rstack.length}`);
  } else {
    out.push('no mounted router passed for inspection');
  }

  // Utility to get routes from a router stack
  function extractFromStack(stack: any[], prefix = '') {
    const lines: string[] = [];
    for (const layer of stack) {
      try {
        // direct route
        if (layer && layer.route && layer.route.path) {
          const methods = layer.route.methods ? Object.keys(layer.route.methods).map(m => m.toUpperCase()).join('|') : '';
          lines.push(`${methods} ${prefix}${layer.route.path}`);
          continue;
        }

        // mounted router (layer.name === 'router')
        if (layer && (layer.name === 'router' || layer.handle?.stack)) {
          // try to derive mount point (best-effort)
          const mountPath = layer.regexp ? (layer.regexp.fast_slash ? '' : (layer.regexp?.toString() || '')) : '';
          const innerStack = safeStack(layer.handle || layer);
          // don't attempt to clean regexp -> just recurse with same prefix (we will also inspect the mountedRouter directly)
          lines.push(...extractFromStack(innerStack, prefix));
          continue;
        }
      } catch (err) {
        // ignore malformed entries
      }
    }
    return lines;
  }

  // Get routes from top-level app (this may be empty if routes were mounted on a router)
  const appRoutes = extractFromStack(top, '');
  if (appRoutes.length) out.push('Routes on app:\n' + appRoutes.join('\n'));

  // If they mounted a router under mountPath, inspect that router stack directly (this is where TSOA normally registers)
  if (mountedRouter) {
    const routerStack = safeStack(mountedRouter);
    const routerRoutes = extractFromStack(routerStack, mountPath);
    if (routerRoutes.length) out.push('Routes on mounted router:\n' + routerRoutes.join('\n'));
    else out.push('No routes found inside mounted router (router.stack empty or no route layers).');
  }

  console.log('\n==== ROUTE DEBUG ====\n' + out.join('\n') + '\n=====================');
}

export default prettyListRoutes;