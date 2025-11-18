const output = ksu.exec("sh /data/adb/modules/PairipDisabler/action.sh");

document.addEventListener('DOMContentLoaded', loadApps);

async function loadApps() {
    const status = document.getElementById('status');
    try {
        const appResponse = await fetch('applist.json');
        if (!appResponse.ok) {
            throw new Error(`HTTP ${appResponse.status}: Failed to load applist.json`);
        }
        const appText = await appResponse.text();
        console.log('Raw applist.json preview:', appText.substring(0, 300) + '...');  // Debug: Check console (F12)
        if (!appText.trim()) {
            throw new Error('applist.json is empty - reinstall module');
        }
        const pkgs = JSON.parse(appText);
        console.log('Parsed pkgs type:', Array.isArray(pkgs) ? 'Array' : typeof pkgs, 'Length:', pkgs.length);  // Debug
        if (!Array.isArray(pkgs)) {
            throw new Error('applist.json must be an array');
        }

        // Backward compat: If array of strings (old format), wrap as objects
        const normalizedPkgs = pkgs.map(item => {
            if (typeof item === 'string') {
                console.warn('Old string format detected, wrapping as object');  // Debug
                return { package: item, name: item };
            }
            if (typeof item === 'object' && item.package && item.name) {
                return item;
            }
            throw new Error('Invalid item in applist.json: ' + JSON.stringify(item));
        });

        // Load disabled
        let disabledPkgs = [];
        try {
            const disabledResponse = await fetch('disabled.json');
            if (disabledResponse.ok) {
                const disabledText = await disabledResponse.text();
                if (disabledText.trim()) {
                    disabledPkgs = JSON.parse(disabledText);
                }
            }
        } catch (e) {
            console.warn('disabled.json load failed:', e);
        }

        const appList = document.getElementById('appList');
        appList.innerHTML = '';
        if (normalizedPkgs.length === 0) {
            appList.innerHTML = '<div class="app-item"><span style="color: #888;">No user apps detected. Reinstall module.</span></div>';
            return;
        }
        normalizedPkgs.forEach(appObj => {
            const { package: pkg, name } = appObj;
            const displayName = (name === pkg ? pkg : `${name} (${pkg})`);
            console.log('Rendering:', displayName);  // Debug first few
            const div = document.createElement('div');
            div.className = 'app-item';
            div.innerHTML = `
                <span class="app-name">${displayName}</span>
                <input type="checkbox" class="select-toggle" data-pkg="${pkg}">
            `;
            const checkbox = div.querySelector('.select-toggle');
            checkbox.checked = disabledPkgs.includes(pkg);
            appList.appendChild(div);
        });
        attachSearchEvent();
        status.textContent = `Loaded ${normalizedPkgs.length} user apps successfully.`;
        status.className = 'status success';
    } catch (error) {
        console.error('Full load error:', error);
        status.textContent = `Error loading app list: ${error.message}`;
        status.className = 'status error';
    }
}

function attachSearchEvent() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        document.querySelectorAll('.app-item').forEach(item => {
            const appName = item.querySelector('.app-name').textContent.toLowerCase();
            item.style.display = term ? (appName.includes(term) ? 'flex' : 'none') : 'flex';
        });
    });
}

document.getElementById('saveButton').addEventListener('click', async () => {
    const checkboxes = document.querySelectorAll('.select-toggle');
    if (checkboxes.length === 0) {
        alert('No apps loaded! Check console (F12).');
        return;
    }

    const saveButton = document.getElementById('saveButton');
    const status = document.getElementById('status');
    saveButton.disabled = true;
    saveButton.textContent = 'Processing...';
    status.textContent = '';
    status.className = 'status';

    let disabledCount = 0, enabledCount = 0, errorCount = 0, skippedCount = 0;

    let prevDisabledPkgs = [];
    try {
        const disabledResponse = await fetch('disabled.json');
        if (disabledResponse.ok) {
            const disabledText = await disabledResponse.text();
            if (disabledText.trim()) {
                prevDisabledPkgs = JSON.parse(disabledText);
            }
        }
    } catch {}

    status.textContent = 'Processing...\n\n';

    for (const checkbox of checkboxes) {
        const pkg = checkbox.dataset.pkg;
        const shouldDisable = checkbox.checked;

        if (shouldDisable && !prevDisabledPkgs.includes(pkg)) {
            const cmd = `am force-stop ${pkg} && pm disable ${pkg}/com.pairip.licensecheck.LicenseActivity`;
            try {
                await ksu.exec(cmd);
                disabledCount++;
                status.textContent += `✓ Disabled ${pkg}\n`;
            } catch (error) {
                errorCount++;
                status.textContent += `✗ Disable failed: ${pkg} - ${error.message || 'Error'}\n`;
            }
        } else if (!shouldDisable && prevDisabledPkgs.includes(pkg)) {
            const cmd = `pm enable ${pkg}/com.pairip.licensecheck.LicenseActivity`;
            try {
                await ksu.exec(cmd);
                enabledCount++;
                status.textContent += `✓ Re-enabled ${pkg}\n`;
            } catch (error) {
                errorCount++;
                status.textContent += `✗ Re-enable failed: ${pkg} - ${error.message || 'Error'}\n`;
            }
        } else {
            skippedCount++;
        }
    }

    // Update disabled.json
    const newDisabled = Array.from(document.querySelectorAll('.select-toggle:checked')).map(cb => cb.dataset.pkg);
    const jsonStr = JSON.stringify(newDisabled);
    const writeCmd = `echo '${jsonStr}' > /data/adb/modules/PairipDisabler/webroot/disabled.json`;
    try {
        await ksu.exec(writeCmd);
    } catch (error) {
        errorCount++;
        status.textContent += `\n✗ State update failed: ${error.message || 'Error'}\n`;
    }

    status.textContent += `\nSummary: ${disabledCount} disabled, ${enabledCount} enabled, ${skippedCount} skipped, ${errorCount} errors.`;
    status.className = errorCount > 0 ? 'status error' : 'status success';

    saveButton.disabled = false;
    saveButton.textContent = 'Save Changes';
});
