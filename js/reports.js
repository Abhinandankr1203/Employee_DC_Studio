/**
 * DC Studio Reports Module
 * Vanilla JS IIFE — Site Survey, Quality Checklist, Site Progress
 */
var DCReports = (function () {
    'use strict';

    // ── State ──────────────────────────────────────────────
    var isInitialized = false;
    var activeTab = 'site-survey';
    var mediaMap = {};          // itemId -> [{id, dataUrl, annotated}]
    var cameraStream = null;
    var cameraItemId = null;
    var cameraOrientation = 'landscape'; // 'portrait' | 'landscape'
    var annotationImg = null;   // current image being annotated
    var annotationItemId = null;
    var annotationHistory = [];
    var annotationStep = 0;     // current position in history (for redo)
    var annotationTool = 'pen';
    var annotationColor = '#FF0000';
    var annotationSize = 3;
    var isDrawing = false;
    var drawStart = null;
    var currentDrawAction = null; // tracks current draw stroke/shape
    var eraserPattern = null;     // cached original image pattern for eraser
    var progressCounter = 0;
    var facingMode = 'environment';
    var pdfLogoDataUrl = null;      // pre-loaded DC Studio logo for PDF

    // IndexedDB
    var DB_NAME = 'dc-studio-reports';
    var DB_VERSION = 1;
    var db = null;

    // ── Init ───────────────────────────────────────────────
    function init() {
        if (isInitialized) return;
        isInitialized = true;

        openDB(function () {
            renderSiteSurvey();
            renderQualityChecklist();
            addProgressItem();  // start with one item
            bindEvents();
            setTodayDates();
            loadPdfLogo();
            console.log('DCReports initialized');
        });
    }

    // ── IndexedDB ──────────────────────────────────────────
    function openDB(cb) {
        var req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function (e) {
            var d = e.target.result;
            if (!d.objectStoreNames.contains('reports')) {
                var store = d.createObjectStore('reports', { keyPath: 'id' });
                store.createIndex('by-synced', 'synced');
                store.createIndex('by-created', 'createdAt');
            }
        };
        req.onsuccess = function (e) { db = e.target.result; cb(); };
        req.onerror = function () { console.error('IndexedDB error'); cb(); };
    }

    function saveToDB(report, cb) {
        if (!db) { cb && cb(); return; }
        var tx = db.transaction('reports', 'readwrite');
        tx.objectStore('reports').put(report);
        tx.oncomplete = function () { cb && cb(); };
    }

    // ── Events ─────────────────────────────────────────────
    function bindEvents() {
        // Sidebar tabs
        var tabs = document.querySelectorAll('.sidebar-tab[data-report-tab]');
        tabs.forEach(function (t) {
            t.addEventListener('click', function () {
                switchTab(t.getAttribute('data-report-tab'));
            });
        });

        // Mobile select
        var mobileSelect = document.getElementById('reportsMobileTab');
        if (mobileSelect) {
            mobileSelect.addEventListener('change', function () {
                switchTab(this.value);
            });
        }

        // Site Survey buttons
        bindBtn('ss-submit-btn', submitSiteSurvey);
        bindBtn('ss-pdf-btn', function () { generatePDF('site-survey'); });
        bindBtn('ss-draft-btn', function () { saveDraft('site-survey'); });

        // Quality Checklist buttons
        bindBtn('qc-submit-btn', submitQualityChecklist);
        bindBtn('qc-pdf-btn', function () { generatePDF('quality-checklist'); });
        bindBtn('qc-draft-btn', function () { saveDraft('quality-checklist'); });

        // Site Progress buttons
        bindBtn('sp-submit-btn', submitSiteProgress);
        bindBtn('sp-pdf-btn', function () { generatePDF('site-progress'); });
        bindBtn('sp-draft-btn', function () { saveDraft('site-progress'); });
        bindBtn('sp-add-item-btn', addProgressItem);

        // Orientation selector
        bindBtn('closeOrientationModal', closeOrientationModal);
        bindBtn('cancelOrientationBtn', closeOrientationModal);
        bindBtn('orientPortraitBtn', function () { selectOrientation('portrait'); });
        bindBtn('orientLandscapeBtn', function () { selectOrientation('landscape'); });

        // Camera modal
        bindBtn('closeCameraModal', closeCamera);
        bindBtn('captureBtn', capturePhoto);
        bindBtn('switchCameraBtn', switchCamera);
        bindBtn('retakeBtn', retakePhoto);
        bindBtn('usePhotoBtn', usePhoto);
        bindBtn('annotatePhotoBtn', usePhotoAndAnnotate);

        // Annotation modal
        bindBtn('closeAnnotationModal', closeAnnotation);
        bindBtn('cancelAnnotation', closeAnnotation);
        bindBtn('saveAnnotation', saveAnnotation);

        var colorInput = document.getElementById('annotationColor');
        if (colorInput) colorInput.addEventListener('input', function () {
            annotationColor = this.value;
            // Deselect palette swatches
            document.querySelectorAll('.color-swatch').forEach(function (s) { s.classList.remove('active'); });
        });

        var sizeInput = document.getElementById('annotationSize');
        if (sizeInput) sizeInput.addEventListener('input', function () {
            annotationSize = parseInt(this.value);
            var label = document.getElementById('sizeLabel');
            if (label) label.textContent = annotationSize + 'px';
        });

        // Color palette swatches
        document.querySelectorAll('.color-swatch').forEach(function (swatch) {
            swatch.addEventListener('click', function () {
                var color = this.getAttribute('data-color');
                annotationColor = color;
                document.querySelectorAll('.color-swatch').forEach(function (s) { s.classList.remove('active'); });
                this.classList.add('active');
                var colorPick = document.getElementById('annotationColor');
                if (colorPick) colorPick.value = color;
            });
        });

        // Annotation tool buttons
        document.querySelectorAll('.annotation-toolbar .tool-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var tool = this.getAttribute('data-tool');
                if (tool === 'undo') { undoAnnotation(); return; }
                if (tool === 'redo') { redoAnnotation(); return; }
                if (tool === 'clear') { clearAnnotation(); return; }
                annotationTool = tool;
                document.querySelectorAll('.annotation-toolbar .tool-btn').forEach(function (b) {
                    var t = b.getAttribute('data-tool');
                    if (t !== 'undo' && t !== 'redo' && t !== 'clear') {
                        b.classList.toggle('active', t === tool);
                    }
                });
            });
        });

        // Annotation canvas drawing
        var canvas = document.getElementById('annotationCanvas');
        if (canvas) {
            canvas.addEventListener('mousedown', onDrawStart);
            canvas.addEventListener('mousemove', onDrawMove);
            canvas.addEventListener('mouseup', onDrawEnd);
            canvas.addEventListener('mouseleave', onDrawEnd);
            canvas.addEventListener('touchstart', function (e) { e.preventDefault(); onDrawStart(canvasTouchPos(e)); }, { passive: false });
            canvas.addEventListener('touchmove', function (e) { e.preventDefault(); onDrawMove(canvasTouchPos(e)); }, { passive: false });
            canvas.addEventListener('touchend', function (e) { e.preventDefault(); onDrawEnd(); }, { passive: false });
            canvas.addEventListener('touchcancel', function (e) { e.preventDefault(); onDrawEnd(); }, { passive: false });
        }
    }

    function bindBtn(id, handler) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('click', handler);
    }

    // Get scaled canvas coordinates from mouse event
    function canvasMousePos(e) {
        var canvas = document.getElementById('annotationCanvas');
        if (!canvas) return { offsetX: e.offsetX, offsetY: e.offsetY };
        var rect = canvas.getBoundingClientRect();
        var scaleX = canvas.width / rect.width;
        var scaleY = canvas.height / rect.height;
        return {
            offsetX: (e.clientX - rect.left) * scaleX,
            offsetY: (e.clientY - rect.top) * scaleY
        };
    }

    // Get scaled canvas coordinates from touch event
    // Returns object with _scaled flag so scaledPos() won't double-scale
    function canvasTouchPos(e) {
        var t = e.touches[0] || e.changedTouches[0];
        var canvas = document.getElementById('annotationCanvas');
        if (!canvas) return { offsetX: 0, offsetY: 0, _scaled: true };
        var rect = canvas.getBoundingClientRect();
        var scaleX = canvas.width / rect.width;
        var scaleY = canvas.height / rect.height;
        return {
            offsetX: (t.clientX - rect.left) * scaleX,
            offsetY: (t.clientY - rect.top) * scaleY,
            _scaled: true
        };
    }

    // ── Tab Switching ──────────────────────────────────────
    function switchTab(tab) {
        activeTab = tab;
        document.querySelectorAll('.sidebar-tab[data-report-tab]').forEach(function (t) {
            t.classList.toggle('active', t.getAttribute('data-report-tab') === tab);
        });
        document.querySelectorAll('.report-panel').forEach(function (p) {
            p.classList.remove('active');
        });
        var panels = {
            'site-survey': 'siteSurveyPanel',
            'quality-checklist': 'qualityChecklistPanel',
            'site-progress': 'siteProgressPanel'
        };
        var panel = document.getElementById(panels[tab]);
        if (panel) panel.classList.add('active');

        var mobileSelect = document.getElementById('reportsMobileTab');
        if (mobileSelect) mobileSelect.value = tab;
    }

    function setTodayDates() {
        var today = new Date().toISOString().split('T')[0];
        ['ss-date', 'qc-date', 'sp-date'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el && !el.value) el.value = today;
        });
    }

    // ── Render Site Survey ─────────────────────────────────
    function renderSiteSurvey() {
        renderChecklistSection('ss-floor-section', 'A. Floor', SITE_SURVEY_FLOOR_ITEMS, 1);
        renderChecklistSection('ss-wall-section', 'B. Wall', SITE_SURVEY_WALL_ITEMS, 2);
        renderChecklistSection('ss-other-section', 'C. Other', SITE_SURVEY_OTHER_ITEMS, 3);
    }

    function renderChecklistSection(containerId, title, items, sectionNum) {
        var container = document.getElementById(containerId);
        if (!container) return;

        var html = '<div class="checklist-section open">';
        html += '<button class="checklist-section-header" onclick="DCReports.toggleSection(this)">';
        html += '<h4><span class="section-number">' + sectionNum + '</span> ' + title + '</h4>';
        html += '<i class="fas fa-chevron-down chevron"></i>';
        html += '</button>';
        html += '<div class="checklist-section-body">';

        items.forEach(function (item, idx) {
            html += renderChecklistItem(item, idx + 1);
        });

        html += '</div></div>';
        container.innerHTML = html;
    }

    function renderChecklistItem(item, num) {
        var html = '<div class="checklist-item" data-item-id="' + item.id + '">';
        html += '<div class="checklist-item-label"><span class="item-number">' + num + '.</span> ' + escHtml(item.label) + '</div>';

        if (item.type === 'multiple' && item.hasMultipleFields && item.fields) {
            html += '<div class="multiple-fields" id="fields-' + item.id + '">';
            item.fields.forEach(function (f) {
                html += renderFieldRow(f);
            });
            html += '</div>';
            html += '<button class="add-field-btn" onclick="DCReports.addField(\'' + item.id + '\',\'' + escAttr(item.fields[0].label) + '\',\'' + item.fields[0].type + '\',\'' + escAttr(item.fields[0].placeholder || '') + '\')"><i class="fas fa-plus"></i> Add Field</button>';
        } else if (item.type === 'textarea') {
            html += '<textarea data-field-id="' + item.id + '" placeholder="' + escAttr(item.placeholder || '') + '"></textarea>';
        } else if (item.type === 'text' || item.type === 'number') {
            html += '<input type="' + item.type + '" data-field-id="' + item.id + '" placeholder="' + escAttr(item.placeholder || '') + '">';
        }

        if (item.hasMedia) {
            html += '<div class="checklist-item-controls" style="margin-top:8px">';
            html += '<button class="media-btn" onclick="DCReports.openCamera(\'' + item.id + '\')"><i class="fas fa-camera"></i> Camera</button>';
            html += '<button class="media-btn" onclick="DCReports.openGallery(\'' + item.id + '\')"><i class="fas fa-images"></i> Gallery</button>';
            html += '</div>';
            html += '<div class="item-gallery" id="gallery-' + item.id + '"></div>';
        }

        html += '</div>';
        return html;
    }

    function renderFieldRow(f) {
        return '<div class="field-row">' +
            '<label>' + escHtml(f.label) + '</label>' +
            '<input type="' + (f.type || 'text') + '" data-field-id="' + f.id + '" placeholder="' + escAttr(f.placeholder || '') + '">' +
            '</div>';
    }

    // ── Render Quality Checklist ───────────────────────────
    function renderQualityChecklist() {
        var container = document.getElementById('qc-sections-container');
        if (!container) return;

        var html = '';
        QUALITY_CHECKLIST_SECTIONS.forEach(function (section, sIdx) {
            html += '<div class="checklist-section">';
            html += '<button class="checklist-section-header" onclick="DCReports.toggleSection(this)">';
            html += '<h4><span class="section-number">' + (sIdx + 1) + '</span> ' + escHtml(section.name) + '</h4>';
            html += '<i class="fas fa-chevron-down chevron"></i>';
            html += '</button>';
            html += '<div class="checklist-section-body">';

            section.subsections.forEach(function (sub) {
                html += '<div class="subsection-header">' + escHtml(sub.name) + '</div>';
                sub.items.forEach(function (item, iIdx) {
                    html += renderQualityItem(item, iIdx + 1);
                });
                if (sub.items.length === 0) {
                    html += '<div class="checklist-item" style="color:#9ca3af;font-size:0.8125rem;font-style:italic;">No items in this phase.</div>';
                }
            });

            html += '</div></div>';
        });

        container.innerHTML = html;
    }

    function renderQualityItem(item, num) {
        var html = '<div class="checklist-item" data-item-id="' + item.id + '">';
        html += '<div class="checklist-item-label"><span class="item-number">' + num + '.</span> ' + escHtml(item.label) + '</div>';

        html += '<div class="percentage-remarks-row">';
        html += '<div class="percentage-input-wrap">';
        html += '<input type="number" min="0" max="100" data-field-id="' + item.id + '-pct" placeholder="0">';
        html += '<span>%</span>';
        html += '</div>';
        html += '<input type="text" class="remarks-input" data-field-id="' + item.id + '-remarks" placeholder="Remarks...">';
        html += '</div>';

        if (item.hasMedia) {
            html += '<div class="checklist-item-controls" style="margin-top:8px">';
            html += '<button class="media-btn" onclick="DCReports.openCamera(\'' + item.id + '\')"><i class="fas fa-camera"></i> Camera</button>';
            html += '<button class="media-btn" onclick="DCReports.openGallery(\'' + item.id + '\')"><i class="fas fa-images"></i> Gallery</button>';
            html += '</div>';
            html += '<div class="item-gallery" id="gallery-' + item.id + '"></div>';
        }

        html += '</div>';
        return html;
    }

    // ── Progress Items ─────────────────────────────────────
    function addProgressItem() {
        progressCounter++;
        var list = document.getElementById('sp-items-list');
        if (!list) return;

        var itemId = 'progress-' + progressCounter;
        var div = document.createElement('div');
        div.className = 'progress-item-card';
        div.id = 'card-' + itemId;
        div.innerHTML =
            '<div class="item-header">' +
            '<h4>Item #' + progressCounter + '</h4>' +
            '<button class="remove-item-btn" onclick="DCReports.removeProgressItem(\'' + itemId + '\')"><i class="fas fa-trash-alt"></i></button>' +
            '</div>' +
            '<div class="progress-item-grid">' +
            '<div><label>S. No.</label><input type="text" data-field-id="' + itemId + '-sno" value="' + progressCounter + '"></div>' +
            '<div><label>Description</label><input type="text" data-field-id="' + itemId + '-desc" placeholder="Description of work"></div>' +
            '<div><label>Floor / Area</label><input type="text" data-field-id="' + itemId + '-floor" placeholder="Floor/Area"></div>' +
            '<div><label>Location</label><input type="text" data-field-id="' + itemId + '-location" placeholder="Location"></div>' +
            '</div>' +
            '<div class="checklist-item-controls">' +
            '<button class="media-btn" onclick="DCReports.openCamera(\'' + itemId + '\')"><i class="fas fa-camera"></i> Camera</button>' +
            '<button class="media-btn" onclick="DCReports.openGallery(\'' + itemId + '\')"><i class="fas fa-images"></i> Gallery</button>' +
            '</div>' +
            '<div class="item-gallery" id="gallery-' + itemId + '"></div>';
        list.appendChild(div);
    }

    function removeProgressItem(itemId) {
        var card = document.getElementById('card-' + itemId);
        if (card) card.remove();
        delete mediaMap[itemId];
    }

    // ── Section Toggle ─────────────────────────────────────
    function toggleSection(headerEl) {
        var section = headerEl.closest('.checklist-section');
        if (section) section.classList.toggle('open');
    }

    // ── Add Dynamic Field ──────────────────────────────────
    function addField(itemId, label, type, placeholder) {
        var container = document.getElementById('fields-' + itemId);
        if (!container) return;
        var count = container.querySelectorAll('.field-row').length + 1;
        var fId = itemId + '-extra-' + count;
        var div = document.createElement('div');
        div.className = 'field-row';
        div.innerHTML = '<label>' + escHtml(label) + '</label>' +
            '<input type="' + (type || 'text') + '" data-field-id="' + fId + '" placeholder="' + escAttr(placeholder) + '">';
        container.appendChild(div);
    }

    // ── Orientation Selector ────────────────────────────────
    function openCamera(itemId) {
        cameraItemId = itemId;
        // Show orientation selector first
        document.getElementById('orientationModal').classList.add('active');
    }

    function selectOrientation(orientation) {
        cameraOrientation = orientation;
        closeOrientationModal();
        // Now open the actual camera
        openCameraWithOrientation();
    }

    function closeOrientationModal() {
        document.getElementById('orientationModal').classList.remove('active');
    }

    // ── Camera ─────────────────────────────────────────────
    function openCameraWithOrientation() {
        var modal = document.getElementById('cameraModal');
        modal.classList.add('active');

        // Reset to live view
        document.getElementById('cameraVideoContainer').style.display = '';
        document.getElementById('cameraPreview').style.display = 'none';
        document.getElementById('cameraControlsLive').classList.remove('rpt-hidden');
        document.getElementById('cameraControlsPreview').classList.add('rpt-hidden');

        startCamera();
    }

    function startCamera() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(function (t) { t.stop(); });
        }

        var isPortrait = cameraOrientation === 'portrait';
        var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        var constraints = {
            video: {
                facingMode: { ideal: facingMode },
                width: { ideal: isPortrait ? 1080 : 1920, min: 640 },
                height: { ideal: isPortrait ? 1920 : 1080, min: 480 }
            },
            audio: false
        };

        if (isMobile) {
            constraints.video.aspectRatio = isPortrait ? 9 / 16 : 16 / 9;
        }

        navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
            cameraStream = stream;
            document.getElementById('cameraVideo').srcObject = stream;
        }).catch(function (err) {
            console.error('Camera error with constraints, retrying basic:', err);
            // Retry with basic constraints
            navigator.mediaDevices.getUserMedia({ video: { facingMode: facingMode }, audio: false })
                .then(function (stream) {
                    cameraStream = stream;
                    document.getElementById('cameraVideo').srcObject = stream;
                })
                .catch(function (err2) {
                    console.error('Camera error:', err2);
                    showToast('Camera access denied or unavailable', 'error');
                    closeCamera();
                });
        });
    }

    function switchCamera() {
        facingMode = facingMode === 'environment' ? 'user' : 'environment';
        startCamera();
    }

    function capturePhoto() {
        var video = document.getElementById('cameraVideo');
        var canvas = document.getElementById('cameraCanvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);

        var dataUrl = canvas.toDataURL('image/jpeg', 0.8);

        document.getElementById('cameraPreviewImg').src = dataUrl;
        document.getElementById('cameraVideoContainer').style.display = 'none';
        document.getElementById('cameraPreview').style.display = 'block';
        document.getElementById('cameraControlsLive').classList.add('rpt-hidden');
        document.getElementById('cameraControlsPreview').classList.remove('rpt-hidden');
    }

    function retakePhoto() {
        document.getElementById('cameraVideoContainer').style.display = '';
        document.getElementById('cameraPreview').style.display = 'none';
        document.getElementById('cameraControlsLive').classList.remove('rpt-hidden');
        document.getElementById('cameraControlsPreview').classList.add('rpt-hidden');
    }

    function usePhoto() {
        var dataUrl = document.getElementById('cameraPreviewImg').src;
        compressImage(dataUrl, 1200, 0.7, function (compressed) {
            addMediaToItem(cameraItemId, compressed);
            closeCamera();
        });
    }

    function usePhotoAndAnnotate() {
        var dataUrl = document.getElementById('cameraPreviewImg').src;
        compressImage(dataUrl, 1200, 0.7, function (compressed) {
            addMediaToItem(cameraItemId, compressed);
            closeCamera();
            // Open annotation on the just-added image
            var items = mediaMap[cameraItemId] || [];
            if (items.length > 0) {
                var lastMedia = items[items.length - 1];
                // Small delay to let the camera modal close
                setTimeout(function () {
                    openAnnotation(cameraItemId, lastMedia.id);
                }, 300);
            }
        });
    }

    function closeCamera() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(function (t) { t.stop(); });
            cameraStream = null;
        }
        document.getElementById('cameraModal').classList.remove('active');
    }

    // ── Gallery (file picker) ──────────────────────────────
    function openGallery(itemId) {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.onchange = function () {
            Array.from(input.files).forEach(function (file) {
                var reader = new FileReader();
                reader.onload = function (e) {
                    compressImage(e.target.result, 1200, 0.7, function (compressed) {
                        addMediaToItem(itemId, compressed);
                    });
                };
                reader.readAsDataURL(file);
            });
        };
        input.click();
    }

    // ── Image Compression ──────────────────────────────────
    function compressImage(dataUrl, maxDim, quality, cb) {
        var img = new Image();
        img.onload = function () {
            var w = img.width, h = img.height;
            if (w > maxDim || h > maxDim) {
                var ratio = Math.min(maxDim / w, maxDim / h);
                w = Math.round(w * ratio);
                h = Math.round(h * ratio);
            }
            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            cb(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = dataUrl;
    }

    // ── Media Management ───────────────────────────────────
    function addMediaToItem(itemId, dataUrl) {
        if (!mediaMap[itemId]) mediaMap[itemId] = [];
        var media = { id: 'media-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5), dataUrl: dataUrl };
        mediaMap[itemId].push(media);
        renderItemGallery(itemId);
    }

    function removeMedia(itemId, mediaId) {
        if (mediaMap[itemId]) {
            mediaMap[itemId] = mediaMap[itemId].filter(function (m) { return m.id !== mediaId; });
            renderItemGallery(itemId);
        }
    }

    function renderItemGallery(itemId) {
        var gallery = document.getElementById('gallery-' + itemId);
        if (!gallery) return;
        var items = mediaMap[itemId] || [];
        gallery.innerHTML = items.map(function (m) {
            return '<div class="thumb">' +
                '<img src="' + m.dataUrl + '" onclick="DCReports.openAnnotation(\'' + itemId + '\',\'' + m.id + '\')">' +
                '<button class="remove-thumb" onclick="event.stopPropagation();DCReports.removeMedia(\'' + itemId + '\',\'' + m.id + '\')">&times;</button>' +
                '</div>';
        }).join('');
    }

    // ── Annotation ─────────────────────────────────────────
    function openAnnotation(itemId, mediaId) {
        var items = mediaMap[itemId] || [];
        var media = items.find(function (m) { return m.id === mediaId; });
        if (!media) return;

        annotationItemId = itemId;
        annotationImg = media;
        annotationHistory = [];
        annotationStep = 0;
        currentDrawAction = null;
        eraserPattern = null;

        var canvas = document.getElementById('annotationCanvas');
        var ctx = canvas.getContext('2d');
        var img = new Image();
        img.onload = function () {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            // Cache original image as pattern for eraser
            eraserPattern = ctx.createPattern(img, 'no-repeat');
            annotationHistory.push(canvas.toDataURL());
            annotationStep = 1;
        };
        img.src = media.dataUrl;

        // Reset tool UI
        annotationTool = 'pen';
        document.querySelectorAll('.annotation-toolbar .tool-btn').forEach(function (b) {
            var t = b.getAttribute('data-tool');
            if (t !== 'undo' && t !== 'redo' && t !== 'clear') {
                b.classList.toggle('active', t === 'pen');
            }
        });

        document.getElementById('annotationModal').classList.add('active');
    }

    function getCanvasPos(e) {
        // For mouse events on the canvas, use proper scaling
        var canvas = document.getElementById('annotationCanvas');
        if (!canvas) return { x: e.offsetX, y: e.offsetY };
        var rect = canvas.getBoundingClientRect();
        var scaleX = canvas.width / rect.width;
        var scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX !== undefined ? (e.clientX - rect.left) * scaleX : e.offsetX * scaleX),
            y: (e.clientY !== undefined ? (e.clientY - rect.top) * scaleY : e.offsetY * scaleY)
        };
    }

    // Scale mouse/touch coordinates to actual canvas pixel space
    function scaledPos(e) {
        // Touch events are pre-scaled via canvasTouchPos()
        if (e._scaled) {
            return { x: e.offsetX || 0, y: e.offsetY || 0 };
        }
        var canvas = document.getElementById('annotationCanvas');
        if (!canvas) return { x: e.offsetX || 0, y: e.offsetY || 0 };
        var rect = canvas.getBoundingClientRect();
        var scaleX = canvas.width / rect.width;
        var scaleY = canvas.height / rect.height;
        return {
            x: (e.offsetX || 0) * scaleX,
            y: (e.offsetY || 0) * scaleY
        };
    }

    function onDrawStart(e) {
        isDrawing = true;
        var pos = scaledPos(e);
        drawStart = pos;

        currentDrawAction = {
            tool: annotationTool,
            color: annotationColor,
            size: annotationSize,
            points: [pos],
            startPoint: pos,
            endPoint: null
        };

        var canvas = document.getElementById('annotationCanvas');
        var ctx = canvas.getContext('2d');
        // Scale line width relative to canvas resolution
        var rect = canvas.getBoundingClientRect();
        var displayScale = canvas.width / rect.width;
        var scaledLineWidth = annotationSize * displayScale;

        if (annotationTool === 'pen' || annotationTool === 'eraser') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            if (annotationTool === 'eraser' && eraserPattern) {
                ctx.strokeStyle = eraserPattern;
            } else {
                ctx.strokeStyle = annotationColor;
            }
            ctx.lineWidth = scaledLineWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        }
    }

    function onDrawMove(e) {
        if (!isDrawing || !currentDrawAction) return;
        var pos = scaledPos(e);

        if (annotationTool === 'pen' || annotationTool === 'eraser') {
            currentDrawAction.points.push(pos);
            var canvas = document.getElementById('annotationCanvas');
            var ctx = canvas.getContext('2d');
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
        } else {
            // For shapes, show preview by redrawing from last saved state
            currentDrawAction.endPoint = pos;
            var canvas = document.getElementById('annotationCanvas');
            var ctx = canvas.getContext('2d');
            if (annotationStep > 0 && annotationHistory.length > 0) {
                var lastState = annotationHistory[annotationStep - 1];
                var img = new Image();
                img.onload = function () {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);
                    drawShape(ctx, drawStart.x, drawStart.y, pos.x, pos.y);
                };
                img.src = lastState;
            }
        }
    }

    function onDrawEnd(e) {
        if (!isDrawing) return;
        isDrawing = false;

        var canvas = document.getElementById('annotationCanvas');
        var ctx = canvas.getContext('2d');

        // Reset composite operation
        ctx.globalCompositeOperation = 'source-over';

        if (currentDrawAction && (annotationTool !== 'pen' && annotationTool !== 'eraser') && drawStart) {
            var pos = e ? scaledPos(e) : drawStart;

            // Restore to last saved state and draw final shape
            if (annotationStep > 0 && annotationHistory.length > 0) {
                var img = new Image();
                img.onload = function () {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);
                    drawShape(ctx, drawStart.x, drawStart.y, pos.x, pos.y);
                    pushAnnotationState(canvas);
                };
                img.src = annotationHistory[annotationStep - 1];
                currentDrawAction = null;
                return;
            }
        }

        pushAnnotationState(canvas);
        currentDrawAction = null;
    }

    function pushAnnotationState(canvas) {
        // Trim any redo history beyond current step
        annotationHistory = annotationHistory.slice(0, annotationStep);
        annotationHistory.push(canvas.toDataURL());
        annotationStep = annotationHistory.length;
    }

    function drawShape(ctx, x1, y1, x2, y2) {
        var canvas = document.getElementById('annotationCanvas');
        var rect = canvas.getBoundingClientRect();
        var displayScale = canvas.width / rect.width;

        ctx.strokeStyle = annotationColor;
        ctx.lineWidth = annotationSize * displayScale;
        ctx.fillStyle = annotationColor;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();

        if (annotationTool === 'line') {
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        } else if (annotationTool === 'rect') {
            ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        } else if (annotationTool === 'circle') {
            var radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
            ctx.arc(x1, y1, radius, 0, Math.PI * 2);
            ctx.stroke();
        } else if (annotationTool === 'arrow') {
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            // Arrowhead
            var angle = Math.atan2(y2 - y1, x2 - x1);
            var headLen = 20;
            ctx.beginPath();
            ctx.moveTo(x2, y2);
            ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
            ctx.moveTo(x2, y2);
            ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
            ctx.stroke();
        } else if (annotationTool === 'text') {
            var text = prompt('Enter text:');
            if (text) {
                ctx.font = (annotationSize * displayScale * 5) + 'px Poppins, sans-serif';
                ctx.fillText(text, x1, y1);
            }
        }
    }

    function undoAnnotation() {
        if (annotationStep <= 1) return;
        annotationStep--;
        restoreAnnotationState();
    }

    function redoAnnotation() {
        if (annotationStep >= annotationHistory.length) return;
        annotationStep++;
        restoreAnnotationState();
    }

    function clearAnnotation() {
        if (annotationStep <= 1) return;
        // Go back to original image (step 0)
        annotationStep = 1;
        restoreAnnotationState();
        // Trim redo history
        annotationHistory = annotationHistory.slice(0, 1);
    }

    function restoreAnnotationState() {
        var canvas = document.getElementById('annotationCanvas');
        var ctx = canvas.getContext('2d');
        var img = new Image();
        img.onload = function () {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        };
        img.src = annotationHistory[annotationStep - 1];
    }

    function saveAnnotation() {
        if (annotationImg) {
            var canvas = document.getElementById('annotationCanvas');
            annotationImg.dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            renderItemGallery(annotationItemId);
        }
        closeAnnotation();
    }

    function closeAnnotation() {
        document.getElementById('annotationModal').classList.remove('active');
        annotationImg = null;
        annotationItemId = null;
        annotationHistory = [];
        annotationStep = 0;
        eraserPattern = null;
    }

    // ── Data Collection ────────────────────────────────────
    function collectProjectInfo(prefix) {
        var info = {};
        document.querySelectorAll('[id^="' + prefix + '-"]').forEach(function (el) {
            var key = el.id.replace(prefix + '-', '');
            info[key] = el.value || '';
        });
        return info;
    }

    function collectFieldValues(containerSelector) {
        var data = {};
        document.querySelectorAll(containerSelector + ' [data-field-id]').forEach(function (el) {
            data[el.getAttribute('data-field-id')] = el.value || '';
        });
        return data;
    }

    function collectProgressItems() {
        var items = [];
        document.querySelectorAll('#sp-items-list .progress-item-card').forEach(function (card) {
            var id = card.id.replace('card-', '');
            items.push({
                id: id,
                sno: getFieldVal(id + '-sno'),
                description: getFieldVal(id + '-desc'),
                floorArea: getFieldVal(id + '-floor'),
                location: getFieldVal(id + '-location'),
                images: mediaMap[id] || []
            });
        });
        return items;
    }

    function getFieldVal(fieldId) {
        var el = document.querySelector('[data-field-id="' + fieldId + '"]');
        return el ? el.value : '';
    }

    // ── Submit ─────────────────────────────────────────────
    function submitSiteSurvey() {
        var report = {
            id: 'ss-' + Date.now(),
            type: 'site-survey',
            projectInfo: collectProjectInfo('ss'),
            fields: collectFieldValues('#siteSurveyPanel'),
            media: mediaMap,
            createdAt: new Date().toISOString(),
            synced: false
        };

        showToast('Submitting report...', 'info');
        postJSON('/api/reports/submit', report, function (res) {
            if (res.success) {
                report.synced = true;
                saveToDB(report);
                showToast(res.message || 'Site Survey submitted successfully!', 'success');
            } else {
                saveToDB(report);
                showToast('Saved locally. Server: ' + (res.error || 'Error'), 'error');
            }
        }, function () {
            saveToDB(report);
            showToast('No connection. Report saved offline.', 'error');
        });
    }

    function submitQualityChecklist() {
        var report = {
            id: 'qc-' + Date.now(),
            type: 'quality-checklist',
            projectInfo: collectProjectInfo('qc'),
            fields: collectFieldValues('#qualityChecklistPanel'),
            media: mediaMap,
            createdAt: new Date().toISOString(),
            synced: false
        };

        showToast('Submitting report...', 'info');
        postJSON('/api/reports/submit-quality', report, function (res) {
            if (res.success) {
                report.synced = true;
                saveToDB(report);
                showToast(res.message || 'Quality Checklist submitted!', 'success');
            } else {
                saveToDB(report);
                showToast('Saved locally. Server: ' + (res.error || 'Error'), 'error');
            }
        }, function () {
            saveToDB(report);
            showToast('No connection. Report saved offline.', 'error');
        });
    }

    function submitSiteProgress() {
        var report = {
            id: 'sp-' + Date.now(),
            type: 'site-progress',
            projectInfo: collectProjectInfo('sp'),
            progressItems: collectProgressItems(),
            media: mediaMap,
            createdAt: new Date().toISOString(),
            synced: false
        };

        showToast('Submitting report...', 'info');
        postJSON('/api/reports/submit-progress', report, function (res) {
            if (res.success) {
                report.synced = true;
                saveToDB(report);
                showToast(res.message || 'Site Progress submitted!', 'success');
            } else {
                saveToDB(report);
                showToast('Saved locally. Server: ' + (res.error || 'Error'), 'error');
            }
        }, function () {
            saveToDB(report);
            showToast('No connection. Report saved offline.', 'error');
        });
    }

    // ── Save Draft ─────────────────────────────────────────
    function saveDraft(type) {
        var report;
        if (type === 'site-survey') {
            report = {
                id: 'draft-ss-' + Date.now(),
                type: 'site-survey',
                projectInfo: collectProjectInfo('ss'),
                fields: collectFieldValues('#siteSurveyPanel'),
                media: mediaMap,
                createdAt: new Date().toISOString(),
                synced: false
            };
        } else if (type === 'quality-checklist') {
            report = {
                id: 'draft-qc-' + Date.now(),
                type: 'quality-checklist',
                projectInfo: collectProjectInfo('qc'),
                fields: collectFieldValues('#qualityChecklistPanel'),
                media: mediaMap,
                createdAt: new Date().toISOString(),
                synced: false
            };
        } else {
            report = {
                id: 'draft-sp-' + Date.now(),
                type: 'site-progress',
                projectInfo: collectProjectInfo('sp'),
                progressItems: collectProgressItems(),
                media: mediaMap,
                createdAt: new Date().toISOString(),
                synced: false
            };
        }

        saveToDB(report, function () {
            showToast('Draft saved locally!', 'success');
        });
    }

    // ── PDF Logo Pre-loader ────────────────────────────────
    function loadPdfLogo() {
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function () {
            // Resize to max 280×200 px to keep the data URL small
            var maxW = 280, maxH = 200;
            var w = img.naturalWidth || img.width;
            var h = img.naturalHeight || img.height;
            if (w > maxW || h > maxH) {
                var ratio = Math.min(maxW / w, maxH / h);
                w = Math.round(w * ratio);
                h = Math.round(h * ratio);
            }
            var cnv = document.createElement('canvas');
            cnv.width = w;
            cnv.height = h;
            cnv.getContext('2d').drawImage(img, 0, 0, w, h);
            pdfLogoDataUrl = cnv.toDataURL('image/png');
        };
        img.onerror = function () { pdfLogoDataUrl = null; };
        img.src = '/DC%20Studio%20Logo%20new%20end.png';
    }

    // ── PDF Generation ─────────────────────────────────────
    var PDF_C = {
        bg:     [248, 248, 248],
        dark:   [55,  55,  55 ],
        mid:    [115, 115, 115],
        light:  [210, 210, 210],
        imgBg:  [215, 215, 215],
        dash:   [188, 188, 188],
        accent: [210, 50,  30 ]
    };

    function generatePDF(type) {
        if (typeof window.jspdf === 'undefined') {
            showToast('PDF library not loaded. Please check your internet connection.', 'error');
            return;
        }
        showToast('Generating PDF...', 'info');
        var jsPDF = window.jspdf.jsPDF;
        var doc = new jsPDF('p', 'mm', 'a4');
        if (type === 'site-survey') {
            buildSiteSurveyPDF(doc);
        } else if (type === 'quality-checklist') {
            buildQualityChecklistPDF(doc);
        } else {
            buildSiteProgressPDF(doc);
        }
        var names = {
            'site-survey':        'Site_Survey_Report',
            'quality-checklist':  'Quality_Checklist_Report',
            'site-progress':      'Site_Progress_Report'
        };
        doc.save((names[type] || 'Report') + '_' + new Date().toISOString().split('T')[0] + '.pdf');
        showToast('PDF downloaded!', 'success');
    }

    // ── PDF Primitives ─────────────────────────────────────
    function pdfBg(doc) {
        doc.setFillColor(PDF_C.bg[0], PDF_C.bg[1], PDF_C.bg[2]);
        doc.rect(0, 0, 210, 297, 'F');
    }

    function pdfLogo(doc) {
        // Logo dimensions and position (top-right corner)
        var lw = 30, lh = 21;
        var lx = 198 - lw, ly = 5;

        if (pdfLogoDataUrl) {
            try {
                doc.addImage(pdfLogoDataUrl, 'PNG', lx, ly, lw, lh);
                return;
            } catch (e) { /* fall through to vector fallback */ }
        }

        // Vector fallback: draw D + slash + C + "studio" to match logo style
        var ox = lx + 3, oy = ly + 3;
        // "D"
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(PDF_C.dark[0], PDF_C.dark[1], PDF_C.dark[2]);
        doc.text('D', ox, oy + 11);
        // "C"
        doc.text('C', ox + 12, oy + 11);
        // Orange forward slash between D and C
        doc.setDrawColor(PDF_C.accent[0], PDF_C.accent[1], PDF_C.accent[2]);
        doc.setLineWidth(1.4);
        doc.line(ox + 10, oy + 14, ox + 16, oy + 1);
        // "studio" small text
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        doc.setTextColor(PDF_C.dark[0], PDF_C.dark[1], PDF_C.dark[2]);
        doc.text('studio', ox + 9, oy + 17, { align: 'center' });
        // Reset stroke
        doc.setDrawColor(PDF_C.dark[0], PDF_C.dark[1], PDF_C.dark[2]);
        doc.setLineWidth(0.3);
    }

    function pdfAddPg(doc) {
        doc.addPage();
        pdfBg(doc);
        pdfLogo(doc);
        return 30;  // start below logo (logo occupies y≈5–26)
    }

    function pdfChk(doc, y, need) {
        return (y + need > 280) ? pdfAddPg(doc) : y;
    }

    // ── Cover Page ─────────────────────────────────────────
    // infoGroups: array of string arrays (each group separated by a gap)
    function pdfCover(doc, titleText, infoGroups) {
        pdfBg(doc);
        pdfLogo(doc);

        // Large title — placed below logo (logo ends at ~y=26)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(36);
        doc.setTextColor(PDF_C.dark[0], PDF_C.dark[1], PDF_C.dark[2]);
        doc.text(titleText, 14, 30);

        // "About Project" heading (right-aligned)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(PDF_C.dark[0], PDF_C.dark[1], PDF_C.dark[2]);
        doc.text('About Project', 196, 48, { align: 'right' });

        // Project info lines (right-aligned, bold)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        var iy = 58;
        infoGroups.forEach(function (grp, gi) {
            grp.forEach(function (line) {
                if (line) { doc.text(line, 196, iy, { align: 'right' }); iy += 5; }
            });
            if (gi < infoGroups.length - 1) iy += 3;
        });

        return 110; // y position where sections begin
    }

    // ── Section Header ─────────────────────────────────────
    // letter: single char (A/B/C) or short string; title: section name
    function pdfSectionHead(doc, letter, title, y) {
        y = pdfChk(doc, y, 26);
        var fsz = letter.length === 1 ? 42 : 30;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(fsz);
        doc.setTextColor(PDF_C.dark[0], PDF_C.dark[1], PDF_C.dark[2]);
        doc.text(letter, 12, y + 9);

        // Pill background behind title
        var px = 32, pw = Math.max(60, title.length * 3.4 + 20), ph = 12;
        doc.setFillColor(PDF_C.light[0], PDF_C.light[1], PDF_C.light[2]);
        doc.roundedRect(px, y - 1, pw, ph, 2.5, 2.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(PDF_C.dark[0], PDF_C.dark[1], PDF_C.dark[2]);
        doc.text(title, px + 7, y + 7.5);

        // Full-width horizontal rule
        var lineY = y + 14;
        doc.setDrawColor(PDF_C.light[0], PDF_C.light[1], PDF_C.light[2]);
        doc.setLineWidth(0.5);
        doc.line(12, lineY, 198, lineY);
        return lineY + 7;
    }

    // ── Subsection Label ───────────────────────────────────
    function pdfSubHead(doc, text, y) {
        y = pdfChk(doc, y, 12);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(PDF_C.mid[0], PDF_C.mid[1], PDF_C.mid[2]);
        doc.text(text.toUpperCase(), 30, y);
        doc.setTextColor(PDF_C.dark[0], PDF_C.dark[1], PDF_C.dark[2]);
        return y + 7;
    }

    // ── Item Row ───────────────────────────────────────────
    // Two-column: left = number + label + value text, right = photo or placeholder
    function pdfItemRow(doc, numStr, label, valueLines, images, y) {
        y = pdfChk(doc, y, 66);

        var imgX = 118, imgW = 78, imgH = 52, imgY = y;

        // Large item number
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(PDF_C.dark[0], PDF_C.dark[1], PDF_C.dark[2]);
        doc.text(numStr, 12, y + 8);

        // Item label (bold, wrapping)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        var lblLines = doc.splitTextToSize(label, 84);
        var ty = y + 5;
        lblLines.forEach(function (l) { doc.text(l, 30, ty); ty += 4.5; });
        ty += 1.5;

        // Value / data lines (normal, muted)
        if (valueLines.length > 0) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(PDF_C.mid[0], PDF_C.mid[1], PDF_C.mid[2]);
            valueLines.forEach(function (l) { doc.text(l, 30, ty); ty += 4.5; });
            doc.setTextColor(PDF_C.dark[0], PDF_C.dark[1], PDF_C.dark[2]);
        }

        // Photo or placeholder
        var imgDrawn = false;
        if (images && images.length > 0) {
            try {
                doc.addImage(images[0].dataUrl, 'JPEG', imgX, imgY, imgW, imgH);
                imgDrawn = true;
            } catch (e) { /* fall through */ }
        }
        if (!imgDrawn) {
            doc.setFillColor(PDF_C.imgBg[0], PDF_C.imgBg[1], PDF_C.imgBg[2]);
            doc.roundedRect(imgX, imgY, imgW, imgH, 4, 4, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(PDF_C.dark[0], PDF_C.dark[1], PDF_C.dark[2]);
            doc.text('Project Image', imgX + imgW / 2, imgY + imgH / 2 + 2, { align: 'center' });
        }

        // Dashed separator below left column
        var sepY = Math.max(ty + 4, imgY + imgH + 6);
        if (doc.setLineDashPattern) { doc.setLineDashPattern([1.5, 2.5], 0); }
        doc.setDrawColor(PDF_C.dash[0], PDF_C.dash[1], PDF_C.dash[2]);
        doc.setLineWidth(0.3);
        doc.line(12, sepY, 113, sepY);
        if (doc.setLineDashPattern) { doc.setLineDashPattern([], 0); }

        return sepY + 8;
    }

    // ── Site Survey PDF ────────────────────────────────────
    function buildSiteSurveyPDF(doc) {
        var info = collectProjectInfo('ss');
        var grps = [
            [info.projectNo, info.project, info.location].filter(Boolean),
            [
                info.surveyedBy ? 'Surveyed By - ' + info.surveyedBy : null,
                info.date,
                info.company,
                info.designer ? 'Designer/Architect - ' + info.designer : null,
                info.pm ? 'Project Manager - ' + info.pm : null
            ].filter(Boolean)
        ];
        var y = pdfCover(doc, 'Site Survey', grps);

        [
            { letter: 'A', title: 'Floor Item',  items: SITE_SURVEY_FLOOR_ITEMS },
            { letter: 'B', title: 'Wall Item',   items: SITE_SURVEY_WALL_ITEMS  },
            { letter: 'C', title: 'Other Item',  items: SITE_SURVEY_OTHER_ITEMS }
        ].forEach(function (sec) {
            y = pdfChk(doc, y, 30);
            y = pdfSectionHead(doc, sec.letter, sec.title, y);

            sec.items.forEach(function (item, idx) {
                var num = (idx + 1 < 10 ? '0' : '') + (idx + 1);
                var vals = [];

                // Textarea / text input value
                var el = document.querySelector('[data-field-id="' + item.id + '"]');
                if (el && el.value) {
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(8);
                    vals = vals.concat(doc.splitTextToSize(el.value, 84));
                }

                // Structured sub-fields
                if (item.fields) {
                    item.fields.forEach(function (f) {
                        var fEl = document.querySelector('[data-field-id="' + f.id + '"]');
                        if (fEl && fEl.value) vals.push(f.label + ': ' + fEl.value);
                    });
                    // Extra dynamically-added rows
                    var cont = document.getElementById('fields-' + item.id);
                    if (cont) {
                        cont.querySelectorAll('[data-field-id]').forEach(function (xEl) {
                            var fid = xEl.getAttribute('data-field-id');
                            var isOrig = item.fields.some(function (f) { return f.id === fid; });
                            if (!isOrig && xEl.value) vals.push(xEl.value);
                        });
                    }
                }

                y = pdfItemRow(doc, num, item.label, vals, mediaMap[item.id] || [], y);
            });
            y += 5;
        });
    }

    // ── Quality Checklist PDF ──────────────────────────────
    function buildQualityChecklistPDF(doc) {
        var info = collectProjectInfo('qc');
        var grps = [
            [info.project,
             info.floor ? 'Floor: ' + info.floor : null,
             info.room  ? 'Room: '  + info.room  : null].filter(Boolean),
            [info.representative ? 'DC Rep: ' + info.representative : null,
             info.date].filter(Boolean)
        ];
        var y = pdfCover(doc, 'Quality Checklist', grps);

        QUALITY_CHECKLIST_SECTIONS.forEach(function (sec, si) {
            var letter = String(si + 1);
            y = pdfChk(doc, y, 30);
            y = pdfSectionHead(doc, letter, sec.name, y);

            sec.subsections.forEach(function (sub) {
                if (!sub.items.length) return;
                y = pdfSubHead(doc, sub.name, y);

                sub.items.forEach(function (item, ii) {
                    var num = (ii + 1 < 10 ? '0' : '') + (ii + 1);
                    var pctEl = document.querySelector('[data-field-id="' + item.id + '-pct"]');
                    var remEl = document.querySelector('[data-field-id="' + item.id + '-remarks"]');
                    var pct = pctEl ? pctEl.value : '';
                    var rem = remEl ? remEl.value : '';
                    var vals = [];
                    if (pct || rem) {
                        var combined = (pct ? pct + '%' : '') + (pct && rem ? ' \u2014 ' : '') + (rem || '');
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(8);
                        vals = doc.splitTextToSize(combined, 84);
                    }
                    y = pdfItemRow(doc, num, item.label, vals, mediaMap[item.id] || [], y);
                });
            });
            y += 5;
        });
    }

    // ── Site Progress PDF ──────────────────────────────────
    function buildSiteProgressPDF(doc) {
        var info = collectProjectInfo('sp');
        var grps = [
            [info.projectNo, info.project, info.location].filter(Boolean),
            [info.date,
             info.company,
             info.pm ? 'Project Manager - ' + info.pm : null].filter(Boolean)
        ];
        var y = pdfCover(doc, 'Site Progress Report', grps);

        y = pdfChk(doc, y, 30);
        y = pdfSectionHead(doc, 'P', 'Progress Items', y);

        collectProgressItems().forEach(function (item, idx) {
            var num = (idx + 1 < 10 ? '0' : '') + (idx + 1);
            var vals = [];
            if (item.description) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                vals = vals.concat(doc.splitTextToSize(item.description, 84));
            }
            if (item.floorArea) vals.push('Floor/Area: ' + item.floorArea);
            if (item.location)  vals.push('Location: '   + item.location);
            y = pdfItemRow(doc, num, 'Progress Item ' + (idx + 1), vals, item.images || [], y);
        });
    }

    // ── HTTP Helpers ───────────────────────────────────────
    function postJSON(url, data, onSuccess, onError) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onload = function () {
            try {
                var res = JSON.parse(xhr.responseText);
                onSuccess(res);
            } catch (e) {
                onError(e);
            }
        };
        xhr.onerror = function () { onError(new Error('Network error')); };
        xhr.send(JSON.stringify(data));
    }

    // ── Toast ──────────────────────────────────────────────
    function showToast(msg, type) {
        var toast = document.getElementById('reportToast');
        if (!toast) return;
        toast.textContent = msg;
        toast.className = 'report-toast ' + (type || 'info');
        // Force reflow
        toast.offsetHeight;
        toast.classList.add('show');
        setTimeout(function () {
            toast.classList.remove('show');
        }, 3500);
    }

    // ── Utilities ──────────────────────────────────────────
    function escHtml(s) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(s));
        return div.innerHTML;
    }

    function escAttr(s) {
        return s.replace(/'/g, '&#39;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ── Public API ─────────────────────────────────────────
    return {
        init: init,
        toggleSection: toggleSection,
        addField: addField,
        openCamera: openCamera,
        openGallery: openGallery,
        openAnnotation: openAnnotation,
        removeMedia: removeMedia,
        removeProgressItem: removeProgressItem
    };
})();
