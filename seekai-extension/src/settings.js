/**
 * Seekai Settings Page
 * Manages user preferences and custom commands
 */

class SettingsManager {
  constructor() {
    this.settings = {
      enableBookmarks: true,
      enableTabs: false,
      enableCommands: true,
      theme: 'theme-void-core',
      defaultSearchEngine: 'google',
      maxResults: '10',
      zenMode: false,
      customCommands: []
    };

    this.elements = {};
  }

  /**
   * Initialize settings manager
   */
  async init() {
    this.cacheElements();
    await this.loadSettings();
    this.renderSettings();
    this.attachEventListeners();
  }

  /**
   * Cache DOM elements
   */
  cacheElements() {
    this.elements = {
      toggleBookmarks: document.getElementById('toggleBookmarks'),
      toggleTabs: document.getElementById('toggleTabs'),
      toggleCommands: document.getElementById('toggleCommands'),
      toggleZenMode: document.getElementById('toggleZenMode'),
      themeSelect: document.getElementById('themeSelect'),
      searchEngineSelect: document.getElementById('searchEngineSelect'),
      maxResultsSelect: document.getElementById('maxResultsSelect'),
      themePreview: document.getElementById('themePreview'),
      customCommandsList: document.getElementById('customCommandsList'),
      addCommandBtn: document.getElementById('addCommandBtn'),
      saveBtn: document.getElementById('saveBtn'),
      resetBtn: document.getElementById('resetBtn'),
      exportBackupBtn: document.getElementById('exportBackupBtn'),
      importBackupBtn: document.getElementById('importBackupBtn'),
      importBackupFile: document.getElementById('importBackupFile')
    };
  }

  /**
   * Load settings from storage
   */
  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get({
        enableBookmarks: true,
        enableTabs: false,
        enableCommands: true,
        theme: 'theme-void-core',
        defaultSearchEngine: 'google',
        maxResults: '10',
        zenMode: false,
        customCommands: []
      });
      
      this.settings = result;
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.showToast('Failed to load settings');
    }
  }

  /**
   * Render settings to UI
   */
  renderSettings() {
    // Toggle switches
    this.setToggleState(this.elements.toggleBookmarks, this.settings.enableBookmarks);
    this.setToggleState(this.elements.toggleTabs, this.settings.enableTabs);
    this.setToggleState(this.elements.toggleCommands, this.settings.enableCommands);
    this.setToggleState(this.elements.toggleZenMode, this.settings.zenMode);
    
    if (this.elements.themeSelect) {
      this.elements.themeSelect.value = this.settings.theme || 'theme-void-core';
    }

    if (this.elements.searchEngineSelect) {
      this.elements.searchEngineSelect.value = this.settings.defaultSearchEngine || 'google';
    }

    if (this.elements.maxResultsSelect) {
      this.elements.maxResultsSelect.value = this.settings.maxResults || '10';
    }

    // Render theme selector
    this.renderThemeSelector();

    // Custom commands
    this.renderCustomCommands();
  }

  /**
   * Set toggle switch state
   * @param {HTMLElement} element - Toggle element
   * @param {boolean} active - Active state
   */
  setToggleState(element, active) {
    if (element) {
      if (active) {
        element.classList.add('active');
      } else {
        element.classList.remove('active');
      }
    }
  }

  /**
   * Render theme selector
   */
  renderThemeSelector() {
    // Populate theme dropdown
    const themes = themeManager.getThemes();
    if (!this.elements.themeSelect) return;
    this.elements.themeSelect.innerHTML = '';
    
    themes.forEach(theme => {
      const option = document.createElement('option');
      option.value = theme.id;
      option.textContent = theme.name;
      if (theme.id === this.settings.theme) {
        option.selected = true;
      }
      this.elements.themeSelect.appendChild(option);
    });

    // Render preview
    this.renderThemePreview(this.settings.theme);
  }

  /**
   * Render theme preview
   * @param {string} themeId - Theme ID
   */
  renderThemePreview(themeId) {
    const theme = themeManager.getThemeById(themeId);
    if (!theme || !this.elements.themePreview) return;

    this.elements.themePreview.innerHTML = `
      <div class="theme-preview-color" style="background: ${theme.colors.primary};"></div>
      <div class="theme-preview-color" style="background: ${theme.colors.secondary};"></div>
      <div class="theme-preview-info">
        <div class="theme-preview-name">${theme.name}</div>
        <div class="theme-preview-desc">${theme.description}</div>
      </div>
    `;
  }

  /**
   * Render custom commands
   */
  renderCustomCommands() {
    if (!this.elements.customCommandsList) return;
    this.elements.customCommandsList.innerHTML = '';

    this.settings.customCommands.forEach((command, index) => {
      const commandItem = this.createCommandItem(command, index);
      this.elements.customCommandsList.appendChild(commandItem);
    });
  }

  /**
   * Create custom command item
   * @param {Object} command - Command data
   * @param {number} index - Command index
   * @returns {HTMLElement}
   */
  createCommandItem(command, index) {
    const item = document.createElement('div');
    item.className = 'command-item';
    
    // Check if this is a new bookmark (no bookmarkId) or existing
    const isNew = !command.bookmarkId;
    const buttonText = isNew ? 'Add' : 'Delete';
    const buttonClass = isNew ? 'add-btn' : 'delete-btn';
    
    item.innerHTML = `
      <input type="text" placeholder="Bookmark name (e.g., GitHub)" value="${command.title || ''}" data-field="title" data-index="${index}">
      <input type="text" placeholder="URL (e.g., https://github.com)" value="${command.url || ''}" data-field="url" data-index="${index}">
      <button class="${buttonClass}" data-index="${index}">${buttonText}</button>
    `;

    // Add input listeners
    const inputs = item.querySelectorAll('input');
    inputs.forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.index);
        const field = e.target.dataset.field;
        this.settings.customCommands[idx][field] = e.target.value;
      });
    });

    // Add button listener
    const actionBtn = item.querySelector('button');
    actionBtn.addEventListener('click', async () => {
      if (isNew) {
        // Add button - save immediately
        await this.addBookmarkImmediately(index);
      } else {
        // Delete button - remove bookmark
        this.deleteCommand(index);
      }
    });

    return item;
  }

  /**
   * Add bookmark immediately (for new bookmarks)
   * @param {number} index - Command index
   */
  async addBookmarkImmediately(index) {
    const command = this.settings.customCommands[index];
    
    if (!command.title || !command.url) {
      this.showToast('Please fill in both name and URL');
      return;
    }

    try {
      // Check for duplicates
      const duplicate = await this.checkDuplicateBookmark(command.url);
      if (duplicate) {
        const confirmAdd = confirm(
          `A bookmark with this URL already exists:\n\n"${duplicate.title}"\n\nDo you want to add it anyway?`
        );
        if (!confirmAdd) {
          return;
        }
      }

      const seekaiFolder = await this.ensureSeekaiFolder();
      
      // Create new bookmark
      const bookmark = await chrome.bookmarks.create({
        parentId: seekaiFolder.id,
        title: command.title,
        url: command.url
      });
      
      command.bookmarkId = bookmark.id;
      
      // Save to storage
      await chrome.storage.sync.set(this.settings);
      
      this.showToast('Bookmark added successfully!');
      
      // Re-render to show delete button instead
      this.renderCustomCommands();
      
    } catch (error) {
      console.error('Failed to add bookmark:', error);
      this.showToast('Failed to add bookmark');
    }
  }

  /**
   * Check if bookmark URL already exists
   * @param {string} url - URL to check
   * @returns {Promise<Object|null>} Existing bookmark or null
   */
  async checkDuplicateBookmark(url) {
    try {
      // Normalize URL (remove trailing slash, etc.)
      const normalizedUrl = url.trim().replace(/\/$/, '');
      
      // Search all bookmarks for this URL
      const results = await chrome.bookmarks.search({ url: normalizedUrl });
      
      // Also check with trailing slash
      const resultsWithSlash = await chrome.bookmarks.search({ url: normalizedUrl + '/' });
      
      const allResults = [...results, ...resultsWithSlash];
      
      return allResults.length > 0 ? allResults[0] : null;
    } catch (error) {
      console.error('Failed to check for duplicates:', error);
      return null;
    }
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Toggle switches
    if (this.elements.toggleBookmarks) {
      this.elements.toggleBookmarks.addEventListener('click', () => {
        this.settings.enableBookmarks = !this.settings.enableBookmarks;
        this.setToggleState(this.elements.toggleBookmarks, this.settings.enableBookmarks);
        this.saveSettings();
      });
    }

    if (this.elements.toggleTabs) {
      this.elements.toggleTabs.addEventListener('click', () => {
        this.settings.enableTabs = !this.settings.enableTabs;
        this.setToggleState(this.elements.toggleTabs, this.settings.enableTabs);
        this.saveSettings();
      });
    }

    if (this.elements.toggleCommands) {
      this.elements.toggleCommands.addEventListener('click', () => {
        this.settings.enableCommands = !this.settings.enableCommands;
        this.setToggleState(this.elements.toggleCommands, this.settings.enableCommands);
        this.saveSettings();
      });
    }

    // Toggle Zen Mode
    if (this.elements.toggleZenMode) {
      this.elements.toggleZenMode.addEventListener('click', () => {
        this.settings.zenMode = !this.settings.zenMode;
        this.setToggleState(this.elements.toggleZenMode, this.settings.zenMode);
        this.saveSettings();
      });
    }

    // Theme selector
    this.elements.themeSelect.addEventListener('change', async (e) => {
      const themeId = e.target.value;
      this.settings.theme = themeId;
      await themeManager.setTheme(themeId);
      this.renderThemePreview(themeId);
      this.saveSettings();
    });

    // Dropdown listeners
    if (this.elements.searchEngineSelect) {
      this.elements.searchEngineSelect.addEventListener('change', (e) => {
        this.settings.defaultSearchEngine = e.target.value;
        this.saveSettings();
      });
    }

    if (this.elements.maxResultsSelect) {
      this.elements.maxResultsSelect.addEventListener('change', (e) => {
        this.settings.maxResults = e.target.value;
        this.saveSettings();
      });
    }

    // Add command button
    if (this.elements.addCommandBtn) {
      this.elements.addCommandBtn.addEventListener('click', () => {
        this.addCommand();
      });
    }

    // Save button
    this.elements.saveBtn.addEventListener('click', () => {
      this.saveSettings();
    });

    // Reset button
    this.elements.resetBtn.addEventListener('click', () => {
      this.resetSettings();
    });

    // Backup & Restore
    if (this.elements.exportBackupBtn) {
      this.elements.exportBackupBtn.addEventListener('click', () => this.exportBackup());
    }

    if (this.elements.importBackupBtn) {
      this.elements.importBackupBtn.addEventListener('click', () => {
        if (this.elements.importBackupFile) {
          this.elements.importBackupFile.click();
        }
      });
    }

    if (this.elements.importBackupFile) {
      this.elements.importBackupFile.addEventListener('change', (e) => this.importBackup(e));
    }
  }

  /**
   * Add new custom command
   */
  addCommand() {
    const newCommand = {
      id: `cmd_${Date.now()}`,
      title: '',
      url: ''
    };

    this.settings.customCommands.push(newCommand);
    this.renderCustomCommands();
  }

  /**
   * Delete custom command
   * @param {number} index - Command index
   */
  async deleteCommand(index) {
    // Check if this was saved as a real bookmark and delete it
    const command = this.settings.customCommands[index];
    if (command.bookmarkId) {
      try {
        await chrome.bookmarks.remove(command.bookmarkId);
      } catch (error) {
        console.error('Failed to delete bookmark:', error);
      }
    }
    
    this.settings.customCommands.splice(index, 1);
    this.renderCustomCommands();
  }

  /**
   * Save settings to storage
   */
  async saveSettings() {
    try {
      // Filter out empty commands
      const validCommands = this.settings.customCommands.filter(
        cmd => cmd.title && cmd.url
      );

      // Only update existing bookmarks (new ones are added via Add button)
      if (validCommands.some(cmd => cmd.bookmarkId)) {
        const seekaiFolder = await this.ensureSeekaiFolder();
        
        for (const cmd of validCommands) {
          if (cmd.bookmarkId) {
            // Update existing bookmark
            try {
              await chrome.bookmarks.update(cmd.bookmarkId, {
                title: cmd.title,
                url: cmd.url
              });
            } catch (error) {
              console.error('Failed to update bookmark:', error);
            }
          }
        }
      }

      this.settings.customCommands = validCommands;

      // Save to storage
      await chrome.storage.sync.set(this.settings);

      this.showToast('Settings saved successfully!');

      // Reload after 1 second to apply changes
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showToast('Failed to save settings');
    }
  }

  /**
   * Ensure Seekai bookmarks folder exists
   * @returns {Promise<Object>} Folder bookmark object
   */
  async ensureSeekaiFolder() {
    try {
      // Search for existing Pinboard or Seekai folder
      const pinboardBookmarks = await chrome.bookmarks.search({ title: 'Pinboard Bookmarks' });
      let folder = pinboardBookmarks.find(b => !b.url);
      
      if (!folder) {
        const seekaiBookmarks = await chrome.bookmarks.search({ title: 'Seekai Bookmarks' });
        folder = seekaiBookmarks.find(b => !b.url);
      }
      
      if (folder) {
        return folder;
      }

      // Create new folder in the bookmarks bar
      const bookmarksBar = await chrome.bookmarks.getTree();
      let bookmarksBarId = '1';
      if (bookmarksBar && bookmarksBar[0] && bookmarksBar[0].children && bookmarksBar[0].children[0]) {
        bookmarksBarId = bookmarksBar[0].children[0].id;
      }

      return await chrome.bookmarks.create({
        parentId: bookmarksBarId,
        title: 'Pinboard Bookmarks'
      });
    } catch (error) {
      console.error('Failed to create Pinboard folder:', error);
      // Fallback: use bookmarks bar root
      return { id: '1' };
    }
  }

  /**
   * Reset settings to defaults
   */
  async resetSettings() {
    if (!confirm('Are you sure you want to reset all settings to defaults?')) {
      return;
    }

    try {
      const defaults = {
        enableBookmarks: true,
        enableHistory: false,
        enableTabs: false,
        enableCommands: true,
        accentColor: 'cyan',
        customCommands: []
      };

      this.settings = defaults;
      await chrome.storage.sync.set(defaults);

      this.renderSettings();
      this.showToast('Settings reset to defaults');
    } catch (error) {
      console.error('Failed to reset settings:', error);
      this.showToast('Failed to reset settings');
    }
  }

  /**
   * Helper to recursively extract bookmarks from a Chrome bookmark tree
   */
  extractBookmarksFromTree(nodes, parentTitle = '') {
    const list = [];
    for (const node of nodes) {
      if (node.url) {
        list.push({
          id: node.id,
          title: node.title || 'Untitled',
          url: node.url,
          folder: parentTitle || 'Bookmarks',
          dateAdded: node.dateAdded
        });
      }
      if (node.children) {
        list.push(...this.extractBookmarksFromTree(node.children, node.title || parentTitle));
      }
    }
    return list;
  }

  /**
   * Export all bookmarks, pinned status, click stats, and settings to a JSON file
   */
  async exportBackup() {
    try {
      const localData = await chrome.storage.local.get(null);
      const syncData = await chrome.storage.sync.get(null);
      const bookmarkTree = await chrome.bookmarks.getTree();
      const allBookmarks = this.extractBookmarksFromTree(bookmarkTree);

      const bookmarkStats = localData.bookmarkStats || {};
      const pinnedLinks = new Set(localData.pinnedLinks || []);

      const statsByUrl = {};
      const pinnedUrls = [];
      const enrichedBookmarks = [];

      for (const b of allBookmarks) {
        const stats = bookmarkStats[b.id] || (b.url && bookmarkStats[b.url]) || { count: 0, lastUsed: 0 };
        const isPinned = pinnedLinks.has(b.id) || (b.url && pinnedLinks.has(b.url));

        if (b.url) {
          if (stats.count > 0) {
            statsByUrl[b.url] = stats;
          }
          if (isPinned) {
            pinnedUrls.push(b.url);
          }
        }

        enrichedBookmarks.push({
          ...b,
          useCount: stats.count || 0,
          lastUsed: stats.lastUsed || 0,
          isPinned: !!isPinned
        });
      }

      // Also ensure any raw URL entries in storage are captured
      for (const item of pinnedLinks) {
        if (typeof item === 'string' && (item.startsWith('http://') || item.startsWith('https://')) && !pinnedUrls.includes(item)) {
          pinnedUrls.push(item);
        }
      }
      for (const [key, val] of Object.entries(bookmarkStats)) {
        if ((key.startsWith('http://') || key.startsWith('https://')) && !statsByUrl[key]) {
          statsByUrl[key] = val;
        }
      }

      const backup = {
        _source: 'pinboard_full_backup_v3',
        version: 3,
        exportedAt: new Date().toISOString(),
        bookmarks: enrichedBookmarks,
        pinnedUrls: pinnedUrls,
        bookmarkStatsByUrl: statsByUrl,
        bookmarkTree: bookmarkTree,
        local: localData,
        sync: syncData
      };

      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `pinboard_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showToast(`Exported ${enrichedBookmarks.length} bookmarks, ${pinnedUrls.length} pinned!`);
    } catch (error) {
      console.error('Failed to export backup:', error);
      this.showToast('Failed to export backup');
    }
  }

  /**
   * Import storage data and bookmarks from a JSON file
   * @param {Event} event - File input change event
   */
  importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const rawText = (e.target && e.target.result) ? String(e.target.result) : '';
        const trimmed = rawText.trim();
        let data = null;

        // Strategy 1: HTML Bookmark File
        if (trimmed.includes('<DT><A') || trimmed.includes('HREF="') || (file.name && file.name.endsWith('.html'))) {
          const regex = /<A\s+[^>]*HREF="([^"]+)"[^>]*>([^<]*)<\/A>/gi;
          let match;
          const htmlBookmarks = [];
          while ((match = regex.exec(trimmed)) !== null) {
            htmlBookmarks.push({
              url: match[1],
              title: match[2] || 'Bookmark',
              useCount: 0,
              isPinned: false
            });
          }
          data = { bookmarks: htmlBookmarks };
        } else {
          // Strategy 2: Direct JSON parse
          try {
            data = JSON.parse(trimmed);
          } catch (e1) {
            // Strategy 3: Slicing curly braces (object)
            const firstBrace = trimmed.indexOf('{');
            const lastBrace = trimmed.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace > firstBrace) {
              try {
                data = JSON.parse(trimmed.substring(firstBrace, lastBrace + 1));
              } catch (e2) {}
            }

            // Strategy 4: Slicing square brackets (array)
            if (!data) {
              const firstBracket = trimmed.indexOf('[');
              const lastBracket = trimmed.lastIndexOf(']');
              if (firstBracket !== -1 && lastBracket > firstBracket) {
                try {
                  data = JSON.parse(trimmed.substring(firstBracket, lastBracket + 1));
                } catch (e3) {}
              }
            }

            if (!data) {
              throw new Error('Unable to parse JSON: ' + e1.message);
            }
          }
        }

        if (typeof data !== 'object' || data === null) {
          throw new Error('Invalid backup file content');
        }

        // 1. Extract all bookmarks from backup
        let bookmarksToImport = [];
        if (Array.isArray(data)) {
          bookmarksToImport = [...data];
        } else if (Array.isArray(data.bookmarks)) {
          bookmarksToImport = [...data.bookmarks];
        } else if (Array.isArray(data.bookmarkTree)) {
          bookmarksToImport = this.extractBookmarksFromTree(data.bookmarkTree);
        }

        const customCommands = data.sync?.customCommands || data.customCommands || [];
        if (Array.isArray(customCommands)) {
          for (const cmd of customCommands) {
            if (cmd && cmd.url && !bookmarksToImport.some(b => b && b.url === cmd.url)) {
              bookmarksToImport.push({
                title: cmd.title || 'Bookmark',
                url: cmd.url,
                useCount: 0,
                isPinned: false
              });
            }
          }
        }

        // 2. Safely create missing bookmarks in Chrome
        let createdCount = 0;
        try {
          const targetFolder = await this.ensureSeekaiFolder();
          const currentTree = await chrome.bookmarks.getTree();
          const currentBookmarks = this.extractBookmarksFromTree(currentTree);
          const existingUrls = new Set(
            currentBookmarks.map(b => (b && b.url ? String(b.url).trim().replace(/\/$/, '') : ''))
          );

          for (const b of bookmarksToImport) {
            if (!b || !b.url) continue;
            const normUrl = String(b.url).trim().replace(/\/$/, '');
            if (!existingUrls.has(normUrl)) {
              try {
                await chrome.bookmarks.create({
                  parentId: (targetFolder && targetFolder.id) ? targetFolder.id : '1',
                  title: String(b.title || 'Untitled'),
                  url: String(b.url)
                });
                existingUrls.add(normUrl);
                createdCount++;
              } catch (err) {
                console.warn('Failed to create bookmark:', b.url, err);
              }
            }
          }
        } catch (bErr) {
          console.warn('Bookmark creation step had issues:', bErr);
        }

        // 3. Re-read fresh bookmark tree to map IDs
        let freshBookmarks = [];
        try {
          const freshTree = await chrome.bookmarks.getTree();
          freshBookmarks = this.extractBookmarksFromTree(freshTree);
        } catch (tErr) {
          console.warn('Could not read updated bookmark tree:', tErr);
        }

        // 4. Map stats and pins
        const statsByUrl = (data.bookmarkStatsByUrl && typeof data.bookmarkStatsByUrl === 'object') ? data.bookmarkStatsByUrl : {};
        const rawStats = (data.local && typeof data.local.bookmarkStats === 'object') ? data.local.bookmarkStats :
                         (data.bookmarkStats && typeof data.bookmarkStats === 'object') ? data.bookmarkStats : {};

        for (const b of bookmarksToImport) {
          if (b && b.url && Number(b.useCount) > 0) {
            const countNum = Number(b.useCount);
            if (!statsByUrl[b.url] || countNum > (statsByUrl[b.url].count || 0)) {
              statsByUrl[b.url] = { count: countNum, lastUsed: Number(b.lastUsed) || Date.now() };
            }
          }
        }

        const pinnedUrlsSet = new Set();
        if (Array.isArray(data.pinnedUrls)) {
          data.pinnedUrls.forEach(u => u && pinnedUrlsSet.add(String(u)));
        }
        for (const b of bookmarksToImport) {
          if (b && b.url && b.isPinned) {
            pinnedUrlsSet.add(String(b.url));
          }
        }

        const rawPinned = Array.isArray(data.local?.pinnedLinks) ? data.local.pinnedLinks :
                          Array.isArray(data.pinnedLinks) ? data.pinnedLinks : [];
        for (const p of rawPinned) {
          if (typeof p === 'string' && (p.startsWith('http://') || p.startsWith('https://'))) {
            pinnedUrlsSet.add(p);
          }
        }

        let currentStorage = {};
        try {
          currentStorage = await chrome.storage.local.get(['bookmarkStats', 'pinnedLinks']);
        } catch (e) {}

        const finalStats = { ...(currentStorage.bookmarkStats || {}) };
        const finalPinned = new Set(Array.isArray(currentStorage.pinnedLinks) ? currentStorage.pinnedLinks : []);

        for (const b of freshBookmarks) {
          if (!b || !b.url) continue;
          const normUrl = b.url;
          const stat = statsByUrl[normUrl] || rawStats[b.id] || rawStats[normUrl];
          if (stat && (Number(stat.count) > 0 || Number(stat.useCount) > 0)) {
            const c = Number(stat.count || stat.useCount || 0);
            const l = Number(stat.lastUsed || Date.now());
            finalStats[b.id] = { count: c, lastUsed: l };
            finalStats[normUrl] = { count: c, lastUsed: l };
          }

          if (pinnedUrlsSet.has(normUrl) || rawPinned.includes(b.id)) {
            finalPinned.add(b.id);
            finalPinned.add(normUrl);
          }
        }

        for (const pUrl of pinnedUrlsSet) {
          finalPinned.add(pUrl);
        }
        for (const [sUrl, sData] of Object.entries(statsByUrl)) {
          finalStats[sUrl] = sData;
        }

        try {
          await chrome.storage.local.set({
            bookmarkStats: finalStats,
            pinnedLinks: Array.from(finalPinned)
          });
        } catch (locErr) {
          console.warn('Failed saving local storage:', locErr);
        }

        // 5. Restore sync settings & theme safely
        try {
          const syncToSet = (data.sync && typeof data.sync === 'object') ? data.sync : {};
          if (data.theme) syncToSet.theme = data.theme;
          if (data.zenMode !== undefined) syncToSet.zenMode = data.zenMode;
          if (data.maxResults) syncToSet.maxResults = data.maxResults;
          if (data.defaultSearchEngine) syncToSet.defaultSearchEngine = data.defaultSearchEngine;

          if (Object.keys(syncToSet).length > 0) {
            await chrome.storage.sync.set(syncToSet);
            if (syncToSet.theme && typeof themeManager !== 'undefined') {
              await themeManager.setTheme(syncToSet.theme);
            }
          }
        } catch (syncErr) {
          console.warn('Failed saving sync settings:', syncErr);
        }

        this.showToast(`Restored ${createdCount} bookmarks, ${pinnedUrlsSet.size} pinned links! Reloading...`);

        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } catch (error) {
        console.error('Failed to import backup:', error);
        this.showToast('Import failed: ' + (error.message || 'Invalid format'));
      }

      if (this.elements.importBackupFile) {
        this.elements.importBackupFile.value = '';
      }
    };
    reader.readAsText(file);
  }

  /**
   * Show toast notification
   * @param {string} message - Toast message
   */
  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
}

// Initialize settings manager when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const manager = new SettingsManager();
    manager.init();
  });
} else {
  const manager = new SettingsManager();
  manager.init();
}
