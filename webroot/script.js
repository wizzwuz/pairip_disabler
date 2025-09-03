document.addEventListener('DOMContentLoaded', async () => {
  const app = window.licenseApp;

  document.getElementById('searchInput').addEventListener('input', (e) => {
    app.filterApps(e.target.value);
  });

  document.getElementById('selectAll').addEventListener('change', (e) => {
    app.toggleSelectAll(e.target.checked);
  });

  document.getElementById('disableButton').addEventListener('click', () => {
    app.disableSelectedApps();
  });

  document.getElementById('revertButton').addEventListener('click', () => {
    app.revertSelectedApps();
  });

  await app.loadApps();
});
