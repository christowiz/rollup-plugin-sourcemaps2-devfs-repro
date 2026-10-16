import sourcemaps from 'rollup-plugin-sourcemaps2';

export default {
  plugins: [sourcemaps()],
  // Polling makes the watcher hit /dev/fd/* quickly. Vite < 8.3.2 registers no
  // 'error' listener on its watcher, so the EBADF becomes an unhandled event and
  // the dev server process exits.
  // server: { watch: { usePolling: true } },
};
