class MediaDownloader {
    constructor() {
        this.currentPlatform = 'spotify';
        this.downloads = JSON.parse(localStorage.getItem('downloads') || '[]');
        this.apiUrl = 'http://localhost:5000';
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateDownloadsList();
        this.logStatus('Media Downloader initialized', 'info');
    }

    bindEvents() {
        // Platform selection
        document.querySelectorAll('.platform-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectPlatform(e.target.closest('.platform-btn').dataset.platform);
            });
        });

        // Download button
        document.getElementById('downloadBtn').addEventListener('click', () => {
            this.startDownload();
        });

        // Enter key in URL input
        document.getElementById('urlInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.startDownload();
            }
        });
    }

    selectPlatform(platform) {
        this.currentPlatform = platform;
        
        // Update active button
        document.querySelectorAll('.platform-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-platform="${platform}"]`).classList.add('active');
        
        // Update info card
        document.querySelectorAll('.info-card').forEach(card => {
            card.classList.remove('active');
        });
        document.querySelector(`[data-info="${platform}"]`).classList.add('active');
        
        // Update placeholder
        const placeholders = {
            'spotify': 'https://open.spotify.com/track/...',
            'youtube-audio': 'https://www.youtube.com/watch?v=...',
            'youtube-video': 'https://www.youtube.com/watch?v=...',
            'tiktok': 'https://www.tiktok.com/@user/video/...',
            'twitter': 'https://twitter.com/user/status/...'
        };
        document.getElementById('urlInput').placeholder = placeholders[platform];
    }

    async startDownload() {
        const url = document.getElementById('urlInput').value.trim();
        if (!url) {
            this.logStatus('Please enter a URL', 'error');
            return;
        }

        if (!this.validateUrl(url)) {
            this.logStatus('Invalid URL for selected platform', 'error');
            return;
        }

        const downloadBtn = document.getElementById('downloadBtn');
        downloadBtn.disabled = true;
        downloadBtn.textContent = 'Downloading...';

        try {
            await this.simulateDownload(url);
        } catch (error) {
            this.logStatus(`Error: ${error.message}`, 'error');
        } finally {
            downloadBtn.disabled = false;
            downloadBtn.textContent = 'Download';
        }
    }

    validateUrl(url) {
        const patterns = {
            'spotify': /spotify\.com\/(track|album|playlist)/,
            'youtube-audio': /youtube\.com\/watch|youtu\.be\//,
            'youtube-video': /youtube\.com\/watch|youtu\.be\//,
            'tiktok': /tiktok\.com/,
            'twitter': /twitter\.com|x\.com/
        };
        return patterns[this.currentPlatform]?.test(url) || false;
    }

    async simulateDownload(url) {
        try {
            // Start download
            const response = await fetch(`${this.apiUrl}/download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, platform: this.currentPlatform })
            });
            
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error);
            }
            
            // Poll for status
            await this.pollDownloadStatus(data.download_id, url);
            
        } catch (error) {
            this.logStatus(`Error: ${error.message}`, 'error');
        }
    }
    
    async pollDownloadStatus(downloadId, url) {
        while (true) {
            try {
                const response = await fetch(`${this.apiUrl}/status/${downloadId}`);
                const status = await response.json();
                
                if (status.status === 'completed') {
                    this.logStatus('[SUCCESS] Download completed!', 'success');
                    this.logStatus(`Files ready for download`, 'success');
                    
                    const downloadData = {
                        title: status.title || 'Downloaded Media',
                        platform: this.currentPlatform,
                        url,
                        outputPath: status.output_path,
                        files: status.files || [],
                        timestamp: new Date().toISOString()
                    };
                    this.addDownload(downloadData);
                    document.getElementById('urlInput').value = '';
                    break;
                } else if (status.status === 'error') {
                    this.logStatus(`Error: ${status.error}`, 'error');
                    break;
                } else {
                    this.logStatus(`[${this.currentPlatform.toUpperCase()}] ${status.status}`, 'info');
                }
                
                await this.delay(1000);
            } catch (error) {
                this.logStatus(`Status check failed: ${error.message}`, 'error');
                break;
            }
        }
    }



    addDownload(data) {
        this.downloads.unshift(data);
        if (this.downloads.length > 10) {
            this.downloads = this.downloads.slice(0, 10);
        }
        localStorage.setItem('downloads', JSON.stringify(this.downloads));
        this.updateDownloadsList();
    }

    updateDownloadsList() {
        const list = document.getElementById('downloadsList');
        const countElement = document.querySelector('.download-count');
        
        if (this.downloads.length === 0) {
            list.innerHTML = '<div style="text-align: center; color: #64748b; padding: 40px;">No downloads yet</div>';
            countElement.textContent = '0 files';
            return;
        }

        const totalFiles = this.downloads.reduce((sum, d) => sum + (d.files?.length || 0), 0);
        countElement.textContent = `${totalFiles} file${totalFiles !== 1 ? 's' : ''}`;

        list.innerHTML = this.downloads.map(download => `
            <div class="download-item">
                <div class="download-info">
                    <div class="download-title">${download.title}</div>
                    <div class="download-platform">${download.platform}</div>
                    ${download.files ? this.renderDownloadLinks(download) : ''}
                </div>
                <div class="download-time">${this.formatTime(download.timestamp)}</div>
            </div>
        `).join('');
    }
    
    renderDownloadLinks(download) {
        if (!download.files || download.files.length === 0) return '';
        
        return `<div class="download-links">
            ${download.files.map(file => 
                `<a href="${this.apiUrl}/download-file/${download.platform}/${encodeURIComponent(file)}" 
                   class="download-link" download>${file}</a>`
            ).join('')}
        </div>`;
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
    }

    logStatus(message, type = 'info') {
        const log = document.getElementById('statusLog');
        const timestamp = new Date().toLocaleTimeString();
        const className = `status-${type}`;
        
        log.innerHTML += `<div class="${className}">[${timestamp}] ${message}</div>`;
        log.scrollTop = log.scrollHeight;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new MediaDownloader();
});