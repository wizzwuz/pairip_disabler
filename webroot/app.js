class LicenseDisablerApp {
    constructor() {
        this.apps = [];
        this.filteredApps = [];
        this.selectedApps = new Set();
        this.disabledApps = new Set();
        this.loadPersistentData();
    }

    loadPersistentData() {
        try {
            const savedDisabled = localStorage.getItem('disabledApps');
            if (savedDisabled) {
                this.disabledApps = new Set(JSON.parse(savedDisabled));
            }
            this.selectedApps = new Set();
        } catch {
            this.selectedApps = new Set();
            this.disabledApps = new Set();
        }
    }

    savePersistentData() {
        try {
            localStorage.setItem('disabledApps', JSON.stringify(Array.from(this.disabledApps)));
        } catch {}
    }

    async run(command) {
        return new Promise((resolve, reject) => {
            const callbackName = `exec_callback_${Date.now()}`;
            window[callbackName] = (errno, stdout, stderr) => {
                delete window[callbackName];
                if (errno === 0) {
                    resolve(stdout.trim());
                } else {
                    reject(stderr || `Command failed with code ${errno}`);
                }
            };

            try {
                if (typeof ksu !== 'undefined' && ksu.exec) {
                    ksu.exec(command, "{}", callbackName);
                } else {
                    reject('ksu.exec is not available; run in KernelSU-enabled environment');
                }
            } catch (error) {
                delete window[callbackName];
                reject(error.message);
            }
        });
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    async loadApps() {
        try {
            this.showLoading(true);

            let result = '';
            try {
                result = await this.run('pm list packages -3');
            } catch {
                this.apps = [
                    { package: 'com.example.app1', name: 'Example App 1' },
                    { package: 'com.example.app2', name: 'Example App 2' }
                ];
                this.filteredApps = [...this.apps];
                this.renderApps();
                this.showAppSection();
                this.showToast('Fallback apps loaded (no root)', 'info');
                return;
            }

            // Display packages instantly
            const pkgs = result.split('\n').map(line => line.replace('package:', '').trim()).filter(Boolean);
            this.apps = pkgs.map(pkg => ({
                package: pkg,
                name: pkg
            }));
            this.filteredApps = [...this.apps];
            this.renderApps();
            this.showAppSection();
            this.showToast(`Loaded ${this.apps.length} user apps`, 'success');

            // Upgrade names progressively
            setTimeout(async () => {
                for (let i = 0; i < this.apps.length; i++) {
                    try {
                        const label = await this.run(`dumpsys package ${this.apps[i].package} | grep 'application-label:' | head -n 1`);
                        const appLabel = label.replace('application-label:', '').trim();
                        // Only update if appLabel is present and different from the package name
                        if (appLabel && appLabel.length > 0 && appLabel !== this.apps[i].package) {
                            this.apps[i].name = appLabel;
                            this.filteredApps[i].name = appLabel;
                            if (i % 10 === 0) this.renderApps();
                        }
                    } catch {}
                }
                this.renderApps();
            }, 30);

        } finally {
            this.showLoading(false);
        }
    }

    showLoading(show) {
        document.getElementById('loadingSection').style.display = show ? 'block' : 'none';
        document.getElementById('appSection').style.display = show ? 'none' : 'block';
        document.getElementById('actionSection').style.display = show ? 'none' : 'block';
    }

    showAppSection() {
        this.updateAppCount();
        document.getElementById('appSection').style.display = 'block';
        document.getElementById('actionSection').style.display = 'block';
    }

    renderApps() {
        const appList = document.getElementById('appList');
        appList.innerHTML = '';

        this.filteredApps.forEach(app => {
            const isChecked = this.selectedApps.has(app.package);
            const isDisabled = this.disabledApps.has(app.package);
            const disabledLabel = isDisabled ? '<span class="disabled-label">(Disabled)</span>' : '';

            // Show both app name and package if different, else just one line
            const appInfo = (app.name !== app.package)
                ? `<span class="app-name">${app.name} ${disabledLabel}</span>
                   <span class="package-name">${app.package}</span>`
                : `<span class="app-name">${app.package} ${disabledLabel}</span>`;

            const item = document.createElement('div');
            item.className = 'app-row';

            item.innerHTML = `
                <label class="app-checkbox">
                    <input type="checkbox" data-package="${app.package}" ${isChecked ? 'checked' : ''}>
                    <span class="checkmark"></span>
                </label>
                <div class="app-details">
                    ${appInfo}
                </div>
            `;

            const checkbox = item.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) this.selectedApps.add(app.package);
                else this.selectedApps.delete(app.package);
                this.updateSelectAllState();
            });

            appList.appendChild(item);
        });
    }

    filterApps(term) {
        const searchTerm = term.toLowerCase();
        this.filteredApps = this.apps.filter(app =>
            app.name.toLowerCase().includes(searchTerm) ||
            app.package.toLowerCase().includes(searchTerm)
        );
        this.renderApps();
        this.updateSelectAllState();
        this.updateAppCount();
    }

    updateAppCount() {
        document.getElementById('appCount').textContent = `${this.filteredApps.length} apps`;
    }

    updateSelectAllState() {
        const selectAll = document.getElementById('selectAll');
        const visiblePackages = this.filteredApps.map(app => app.package);
        const selectedCount = visiblePackages.filter(p => this.selectedApps.has(p)).length;
        selectAll.checked = visiblePackages.length > 0 && selectedCount === visiblePackages.length;
        selectAll.indeterminate = selectedCount > 0 && selectedCount < visiblePackages.length;
    }

    toggleSelectAll(checked) {
        this.filteredApps.forEach(app => {
            if (checked) this.selectedApps.add(app.package);
            else this.selectedApps.delete(app.package);
        });
        document.querySelectorAll('.app-checkbox input[type="checkbox"]').forEach(cb => {
            const pkg = cb.getAttribute('data-package');
            cb.checked = this.selectedApps.has(pkg);
        });
        this.updateAppCount();
    }

    async disableSelectedApps() {
        if (this.selectedApps.size === 0) {
            this.showToast('No apps selected', 'error');
            return;
        }
        const btn = document.getElementById('disableButton');
        const btnText = btn.querySelector('.button-text');
        const btnLoading = btn.querySelector('.button-loading');
        btn.disabled = true;
        btnText.style.display = 'none';
        btnLoading.style.display = 'flex';

        let processed = 0, failed = 0;
        for (const p of this.selectedApps) {
            try {
                await this.run(`su -c "am force-stop ${p}"`);
                await this.run(`su -c "pm disable ${p}/com.pairip.licensecheck.LicenseActivity"`);
                this.disabledApps.add(p);
                processed++;
            } catch {
                failed++;
            }
        }
        this.showToast(`Disabled ${processed} apps. ${failed} failed.`, failed === 0 ? 'success' : 'error');
        this.savePersistentData();
        this.renderApps();
        this.selectedApps.clear();
        this.updateSelectAllState();

        btn.disabled = false;
        btnText.style.display = 'block';
        btnLoading.style.display = 'none';
    }

    async revertSelectedApps() {
        if (this.selectedApps.size === 0) {
            this.showToast('No apps selected to revert', 'error');
            return;
        }
        const btn = document.getElementById('revertButton');
        btn.disabled = true;

        let processed = 0, failed = 0;
        for (const p of this.selectedApps) {
            try {
                await this.run(`su -c "pm enable ${p}/com.pairip.licensecheck.LicenseActivity"`);
                this.disabledApps.delete(p);
                processed++;
            } catch {
                failed++;
            }
        }
        this.showToast(`Re-enabled ${processed} apps. ${failed} failed.`, failed === 0 ? 'success' : 'error');
        this.savePersistentData();
        this.renderApps();
        this.selectedApps.clear();
        this.updateSelectAllState();

        btn.disabled = false;
    }
}

window.licenseApp = new LicenseDisablerApp();
