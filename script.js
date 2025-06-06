const dropArea = document.getElementById('drop-area');
const fileElem = document.getElementById('fileElem');
const fileList = document.getElementById('file-list');
const addMoreBtn = document.getElementById('add-more');
const downloadBtn = document.getElementById('download');
const container = document.querySelector('.container');

let pdfFiles = [];
let isDraggingInternalPdf = false;

// Detect mobile devices
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           ('ontouchstart' in window) || 
           (navigator.maxTouchPoints > 0);
}

// Create floating particles
function createParticles() {
    const particlesContainer = document.createElement('div');
    particlesContainer.className = 'particles';
    document.body.appendChild(particlesContainer);
    
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.width = particle.style.height = Math.random() * 15 + 5 + 'px';
        particle.style.animationDelay = Math.random() * 15 + 's';
        particle.style.animationDuration = Math.random() * 10 + 15 + 's';
        particlesContainer.appendChild(particle);
    }
}

// Initialize particles on load
createParticles();

// Create drag overlay
const dragOverlay = document.createElement('div');
dragOverlay.className = 'drag-overlay';
dragOverlay.innerHTML = '<div class="drag-overlay-content">Drop PDF files here</div>';
document.body.appendChild(dragOverlay);

// Create delete zone
const deleteZone = document.createElement('div');
deleteZone.className = 'delete-zone';
deleteZone.innerHTML = '<div class="delete-zone-content"><span class="material-symbols-rounded">delete</span>Drop here to delete</div>';
document.body.appendChild(deleteZone);

async function renderFileList() {
    console.log('Rendering file list. Total PDFs:', pdfFiles.length);
    fileList.innerHTML = '';
    
    // Create grid container
    const gridContainer = document.createElement('div');
    gridContainer.className = 'pdf-grid';
    fileList.appendChild(gridContainer);
    
    for (let idx = 0; idx < pdfFiles.length; idx++) {
        const file = pdfFiles[idx];
        const item = document.createElement('div');
        item.className = 'grid-item';
        item.draggable = true;
        item.dataset.idx = idx;
        item.dataset.fileId = file._uniqueId || 'no-id';
        item.dataset.fileName = file.name;
        
        // Create preview container
        const previewContainer = document.createElement('div');
        previewContainer.className = 'preview-container';
        
        // Create file info container
        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';
        
        const fileName = document.createElement('span');
        fileName.className = 'file-name';
        fileName.title = file.name;
        fileName.textContent = file.name.length > 15 ? file.name.substring(0, 12) + '...' : file.name;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.title = 'Remove';
        removeBtn.innerHTML = '<span class="material-symbols-rounded">close</span>';
        
        fileInfo.appendChild(fileName);
        fileInfo.appendChild(removeBtn);
        
        // Add preview and file info to item
        item.appendChild(previewContainer);
        item.appendChild(fileInfo);
        
        // Add with animation
        item.style.opacity = '0';
        item.style.transform = 'translateY(20px) scale(0.9)';
        
        // Mobile touch events for delete
        if (isMobileDevice()) {
            let touchTimer;
            let touchStarted = false;
            
            item.addEventListener('touchstart', (e) => {
                // Don't trigger long press on remove button
                if (e.target.closest('.remove-btn')) return;
                
                touchStarted = true;
                item.classList.add('touch-active');
                
                // Start long press timer
                touchTimer = setTimeout(() => {
                    if (touchStarted) {
                        // Haptic feedback if available
                        if (navigator.vibrate) {
                            navigator.vibrate(50);
                        }
                        
                        // Show delete confirmation
                        showMobileDeleteConfirm(idx, item);
                    }
                }, 800); // 800ms long press
            });
            
            item.addEventListener('touchmove', (e) => {
                // Cancel long press if finger moves too much
                const touch = e.touches[0];
                const rect = item.getBoundingClientRect();
                const x = touch.clientX - rect.left;
                const y = touch.clientY - rect.top;
                
                if (x < -20 || x > rect.width + 20 || y < -20 || y > rect.height + 20) {
                    clearTimeout(touchTimer);
                    touchStarted = false;
                    item.classList.remove('touch-active');
                }
            });
            
            item.addEventListener('touchend', () => {
                clearTimeout(touchTimer);
                touchStarted = false;
                item.classList.remove('touch-active');
            });
            
            item.addEventListener('touchcancel', () => {
                clearTimeout(touchTimer);
                touchStarted = false;
                item.classList.remove('touch-active');
            });
        }
        
        // Generate PDF preview
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
            const page = await pdf.getPage(1); // Get first page
            
            const scale = 0.3; // Adjusted scale for better quality
            const viewport = page.getViewport({scale});
            
            // Create canvas for PDF preview
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            previewContainer.appendChild(canvas);
            
            const context = canvas.getContext('2d');
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
        } catch (err) {
            console.error('Failed to render PDF preview:', err);
            previewContainer.innerHTML = '<div class="preview-error"><span class="material-symbols-rounded">picture_as_pdf</span>PDF Preview</div>';
        }
        
        // Drag events
        item.addEventListener('dragstart', (e) => {
            isDraggingInternalPdf = true;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', idx);
            e.dataTransfer.setData('application/pdf-item', 'true');
            e.dataTransfer.setData('text/pdf-index', idx.toString());
            
            // Show delete zone when dragging PDF items
            deleteZone.classList.add('show');
        });
        
        item.addEventListener('dragend', () => {
            isDraggingInternalPdf = false;
            item.classList.remove('dragging');
            // Hide delete zone when drag ends
            deleteZone.classList.remove('show');
            deleteZone.classList.remove('dragover');
        });
        
        // Touch-based drag and drop for mobile
        if (isMobileDevice()) {
            let touchItem = null;
            let touchOffset = { x: 0, y: 0 };
            let placeholder = null;
            let isDragging = false;
            
            // Create a draggable clone for touch
            item.addEventListener('touchstart', (e) => {
                // Don't interfere with long press for delete
                if (touchStarted) return;
                
                // Don't start drag if touching the remove button
                if (e.target.closest('.remove-btn')) return;
                
                const touch = e.touches[0];
                const rect = item.getBoundingClientRect();
                
                // Store offset
                touchOffset.x = touch.clientX - rect.left;
                touchOffset.y = touch.clientY - rect.top;
                
                // Create clone after a short delay to distinguish from scroll
                setTimeout(() => {
                    if (e.touches.length === 1) {
                        isDragging = true;
                        
                        // Create clone
                        touchItem = item.cloneNode(true);
                        touchItem.className = 'grid-item touch-dragging';
                        touchItem.style.position = 'fixed';
                        touchItem.style.width = rect.width + 'px';
                        touchItem.style.zIndex = '1000';
                        touchItem.style.pointerEvents = 'none';
                        
                        // Position clone at touch point
                        touchItem.style.left = (touch.clientX - touchOffset.x) + 'px';
                        touchItem.style.top = (touch.clientY - touchOffset.y) + 'px';
                        
                        document.body.appendChild(touchItem);
                        
                        // Add placeholder
                        item.classList.add('dragging-placeholder');
                        
                        // Show delete zone
                        deleteZone.classList.add('show');
                        
                        // Haptic feedback
                        if (navigator.vibrate) {
                            navigator.vibrate(20);
                        }
                    }
                }, 150); // 150ms delay to distinguish from scrolling
            });
            
            item.addEventListener('touchmove', (e) => {
                if (!isDragging || !touchItem) return;
                
                e.preventDefault(); // Prevent scrolling while dragging
                const touch = e.touches[0];
                
                // Update clone position
                touchItem.style.left = (touch.clientX - touchOffset.x) + 'px';
                touchItem.style.top = (touch.clientY - touchOffset.y) + 'px';
                
                // Find element under touch point
                const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
                
                // Check if over delete zone
                if (elementBelow && (elementBelow.classList.contains('delete-zone') || 
                    elementBelow.closest('.delete-zone'))) {
                    deleteZone.classList.add('dragover');
                } else {
                    deleteZone.classList.remove('dragover');
                    
                    // Find grid item under touch
                    const gridItemBelow = elementBelow?.closest('.grid-item');
                    
                    if (gridItemBelow && gridItemBelow !== item && 
                        gridItemBelow.parentElement === gridContainer) {
                        // Get all items
                        const items = [...gridContainer.children];
                        const draggedIndex = items.indexOf(item);
                        const targetIndex = items.indexOf(gridItemBelow);
                        
                        if (draggedIndex !== targetIndex) {
                            // Rearrange items
                            if (draggedIndex < targetIndex) {
                                gridItemBelow.after(item);
                            } else {
                                gridItemBelow.before(item);
                            }
                        }
                    }
                }
            });
            
            item.addEventListener('touchend', (e) => {
                if (!isDragging || !touchItem) return;
                
                const touch = e.changedTouches[0];
                const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
                
                // Check if dropped on delete zone
                if (elementBelow && (elementBelow.classList.contains('delete-zone') || 
                    elementBelow.closest('.delete-zone'))) {
                    // Delete the PDF
                    // Remove touch item
                    touchItem.remove();
                    
                    // Animate deletion
                    item.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                    item.style.opacity = '0';
                    item.style.transform = 'scale(0.5) rotate(10deg)';
                    
                    setTimeout(() => {
                        // Remove by unique ID
                        if (file._uniqueId) {
                            pdfFiles = pdfFiles.filter(f => f._uniqueId !== file._uniqueId);
                        } else {
                            const currentIdx = parseInt(item.dataset.idx);
                            pdfFiles.splice(currentIdx, 1);
                        }
                        renderFileList();
                    }, 300);
                } else {
                    // Get final order and update array
                    const items = [...gridContainer.children];
                    const newOrder = [];
                    
                    // Build new order based on DOM position
                    items.forEach(el => {
                        const originalIdx = parseInt(el.dataset.idx);
                        if (!isNaN(originalIdx) && pdfFiles[originalIdx]) {
                            newOrder.push(pdfFiles[originalIdx]);
                        }
                    });
                    
                    // Update the array with new order
                    pdfFiles = newOrder;
                    
                    // Clean up
                    item.classList.remove('dragging-placeholder');
                    if (touchItem) touchItem.remove();
                    
                    // Re-render to update indices
                    renderFileList();
                }
                
                // Clean up
                isDragging = false;
                touchItem = null;
                deleteZone.classList.remove('show');
                deleteZone.classList.remove('dragover');
            });
            
            item.addEventListener('touchcancel', () => {
                // Clean up on cancel
                if (touchItem) touchItem.remove();
                item.classList.remove('dragging-placeholder');
                isDragging = false;
                touchItem = null;
                deleteZone.classList.remove('show');
                deleteZone.classList.remove('dragover');
            });
        }
        
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const draggingItem = document.querySelector('.dragging');
            const siblings = [...gridContainer.querySelectorAll('.grid-item:not(.dragging)')];
            const nextSibling = siblings.find(sibling => {
                return e.clientY <= sibling.getBoundingClientRect().top + sibling.offsetHeight / 2;
            });
            
            if (nextSibling) {
                gridContainer.insertBefore(draggingItem, nextSibling);
            } else {
                gridContainer.appendChild(draggingItem);
            }
        });
        
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
            const toIdx = parseInt(item.dataset.idx);
            
            if (fromIdx !== toIdx) {
                const [movedFile] = pdfFiles.splice(fromIdx, 1);
                pdfFiles.splice(toIdx, 0, movedFile);
                renderFileList();
            }
            
            // Ensure flag is reset
            isDraggingInternalPdf = false;
        });
        

        
        // Remove button click handler
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering other events
            e.preventDefault();
            
            console.log('Remove button clicked for:', file.name, 'ID:', file._uniqueId);
            
            // Animate removal
            item.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            item.style.opacity = '0';
            item.style.transform = 'scale(0.8) rotate(5deg)';
            
            setTimeout(() => {
                // Remove by unique ID for most reliable removal
                const beforeCount = pdfFiles.length;
                
                if (file._uniqueId) {
                    // Remove by unique ID
                    pdfFiles = pdfFiles.filter(f => f._uniqueId !== file._uniqueId);
                } else {
                    // Fallback to removing by reference
                    const fileIndex = pdfFiles.indexOf(file);
                    if (fileIndex > -1) {
                        pdfFiles.splice(fileIndex, 1);
                    }
                }
                
                console.log(`Removed PDF. Before: ${beforeCount}, After: ${pdfFiles.length}`);
                renderFileList();
            }, 300);
        });
        
        // Prevent default touch behavior on remove button
        removeBtn.addEventListener('touchstart', (e) => {
            e.stopPropagation();
        });
        
        gridContainer.appendChild(item);
        
        // Trigger entrance animation
        setTimeout(() => {
            item.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
            item.style.opacity = '1';
            item.style.transform = 'translateY(0) scale(1)';
        }, idx * 100); // Stagger animation
    }
    
    // Show/hide drop area and add more button based on files
    if (pdfFiles.length > 0) {
        dropArea.classList.add('hidden');
        addMoreBtn.style.display = '';
        addMoreBtn.innerHTML = '<span class="material-symbols-rounded">add_circle</span> Add More PDFs';
        
        // Show mobile hint for first time users
        if (isMobileDevice() && pdfFiles.length === 2 && !localStorage.getItem('mobileHintShown')) {
            showMobileHint();
            localStorage.setItem('mobileHintShown', 'true');
        }
    } else {
        dropArea.classList.remove('hidden');
        addMoreBtn.style.display = 'none';
    }
}

function handleFiles(files) {
    let newFilesAdded = false;
    for (const file of files) {
        if (file.type === 'application/pdf') {
            // Add a unique ID to each file for tracking
            file._uniqueId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            pdfFiles.push(file);
            newFilesAdded = true;
        }
    }
    
    if (newFilesAdded) {
        // Add a subtle pulse animation to the container
        container.style.animation = 'none';
        setTimeout(() => {
            container.style.animation = 'containerAppear 0.8s ease-out';
        }, 10);
    }
    
    renderFileList();
}

// Drag and drop on original drop area
dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    dropArea.classList.add('dragover');
});

dropArea.addEventListener('dragleave', (e) => {
    if (e.target === dropArea) {
        dropArea.classList.remove('dragover');
    }
});

dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dropArea.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
});

// Drag and drop on container when drop area is hidden
let dragCounter = 0;
container.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    
    // Only show overlay for external files, not when rearranging PDFs
    if (pdfFiles.length > 0 && dragCounter === 1 && !isDraggingInternalPdf) {
        container.classList.add('dragover');
        dragOverlay.classList.add('show');
    }
});

container.addEventListener('dragleave', (e) => {
    dragCounter--;
    if (dragCounter === 0 && !isDraggingInternalPdf) {
        container.classList.remove('dragover');
        dragOverlay.classList.remove('show');
    }
});

container.addEventListener('dragover', (e) => {
    e.preventDefault();
    
    // Only set copy effect for external files
    if (!isDraggingInternalPdf) {
        e.dataTransfer.dropEffect = 'copy';
    }
});

container.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    container.classList.remove('dragover');
    dragOverlay.classList.remove('show');
    
    // Only handle external files, not PDF items being rearranged
    if (pdfFiles.length > 0 && !isDraggingInternalPdf && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
    }
});

// File selection
dropArea.addEventListener('click', (e) => {
    if (e.target === dropArea || e.target.parentElement === dropArea) {
        fileElem.click();
    }
});

addMoreBtn.addEventListener('click', () => {
    fileElem.click();
});

fileElem.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    fileElem.value = '';
});

// Download with enhanced animations
downloadBtn.addEventListener('click', async () => {
    if (pdfFiles.length < 2) {
        // Shake animation for error
        downloadBtn.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
            downloadBtn.style.animation = '';
        }, 500);
        
        alert('Please add at least two PDF files to merge.');
        return;
    }
    
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = '<span class="material-symbols-rounded">hourglass_empty</span> Merging...';
    
    try {
        const mergedPdf = await mergePDFs(pdfFiles);
        const blob = new Blob([mergedPdf], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'merged-pdfs.pdf';
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // Success animation
            downloadBtn.classList.add('success');
            downloadBtn.innerHTML = '<span class="material-symbols-rounded">check_circle</span> Success!';
            
            // Create confetti effect
            createConfetti();
            
            setTimeout(() => {
                downloadBtn.classList.remove('success');
                downloadBtn.innerHTML = '<span class="material-symbols-rounded">download</span> Merge & Download';
                downloadBtn.disabled = false;
            }, 2000);
        }, 100);
    } catch (err) {
        console.error('Error merging PDFs:', err);
        
        downloadBtn.style.animation = 'shake 0.5s ease-in-out';
        downloadBtn.innerHTML = '<span class="material-symbols-rounded">error</span> Failed';
        
        setTimeout(() => {
            downloadBtn.style.animation = '';
            downloadBtn.innerHTML = '<span class="material-symbols-rounded">download</span> Merge & Download';
            downloadBtn.disabled = false;
        }, 2000);
        
        alert('Failed to merge PDFs: ' + (err.message || 'Unknown error'));
    }
});

// Shake animation
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-10px); }
        75% { transform: translateX(10px); }
    }
    
    @keyframes confetti-fall {
        0% {
            opacity: 1;
            transform: translateY(-100vh) rotate(0deg);
        }
        100% {
            opacity: 0;
            transform: translateY(100vh) rotate(720deg);
        }
    }
    
    .confetti {
        position: fixed;
        width: 10px;
        height: 10px;
        background: linear-gradient(135deg, #667eea, #764ba2, #f093fb, #4facfe);
        animation: confetti-fall 3s ease-out forwards;
        z-index: 9999;
    }
`;
document.head.appendChild(style);

// Confetti effect
function createConfetti() {
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.animationDelay = Math.random() * 0.5 + 's';
        confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
        document.body.appendChild(confetti);
        
        setTimeout(() => {
            confetti.remove();
        }, 3000);
    }
}

async function mergePDFs(files) {
    const { PDFDocument } = PDFLib;
    const mergedPdf = await PDFDocument.create();
    
    for (const file of files) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await PDFDocument.load(arrayBuffer);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        } catch (err) {
            console.error('Failed to load PDF:', file.name, err);
            throw new Error(`Failed to process ${file.name}`);
        }
    }
    
    return await mergedPdf.save();
}

// Show mobile hint for drag and drop
function showMobileHint() {
    const hint = document.createElement('div');
    hint.className = 'mobile-hint';
    hint.innerHTML = `
        <div class="mobile-hint-content">
            <span class="material-symbols-rounded">touch_app</span>
            <p>Touch and drag PDFs to reorder them</p>
        </div>
    `;
    
    document.body.appendChild(hint);
    
    // Animate in
    setTimeout(() => {
        hint.classList.add('show');
    }, 100);
    
    // Auto hide after 4 seconds
    setTimeout(() => {
        hint.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(hint);
        }, 300);
    }, 4000);
}

// Mobile delete confirmation function
function showMobileDeleteConfirm(index, itemElement) {
    // Create mobile delete modal
    const modal = document.createElement('div');
    modal.className = 'mobile-delete-modal';
    modal.innerHTML = `
        <div class="mobile-delete-content">
            <div class="mobile-delete-icon">
                <span class="material-symbols-rounded">delete</span>
            </div>
            <h3>Delete PDF?</h3>
            <p>Are you sure you want to remove "${pdfFiles[index].name}"?</p>
            <div class="mobile-delete-buttons">
                <button class="mobile-cancel-btn">Cancel</button>
                <button class="mobile-delete-btn">Delete</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Animate in
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
    
    // Handle buttons
    const cancelBtn = modal.querySelector('.mobile-cancel-btn');
    const deleteBtn = modal.querySelector('.mobile-delete-btn');
    
    cancelBtn.addEventListener('click', () => {
        modal.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(modal);
        }, 300);
    });
    
    deleteBtn.addEventListener('click', () => {
        // Animate out modal
        modal.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(modal);
        }, 300);
        
        // Delete the PDF with animation
        itemElement.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        itemElement.style.opacity = '0';
        itemElement.style.transform = 'scale(0.5) rotate(10deg)';
        
        setTimeout(() => {
            // Remove by unique ID if available
            const file = pdfFiles[index];
            if (file && file._uniqueId) {
                pdfFiles = pdfFiles.filter(f => f._uniqueId !== file._uniqueId);
            } else {
                pdfFiles.splice(index, 1);
            }
            renderFileList();
        }, 300);
    });
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(modal);
            }, 300);
        }
    });
}

// Delete zone drag and drop handlers
deleteZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('application/pdf-item')) {
        e.dataTransfer.dropEffect = 'move';
        deleteZone.classList.add('dragover');
    }
});

deleteZone.addEventListener('dragleave', (e) => {
    deleteZone.classList.remove('dragover');
});

deleteZone.addEventListener('drop', (e) => {
    e.preventDefault();
    const isPdfItem = e.dataTransfer.getData('application/pdf-item');
    const pdfIndex = e.dataTransfer.getData('text/pdf-index');
    
    if (isPdfItem && pdfIndex !== '' && pdfFiles[parseInt(pdfIndex)]) {
        const index = parseInt(pdfIndex);
        console.log('Deleting PDF:', pdfFiles[index].name);
        
        // Remove the PDF from array
        pdfFiles.splice(index, 1);
        
        // Hide delete zone
        deleteZone.classList.remove('show');
        deleteZone.classList.remove('dragover');
        
        // Re-render the list
        renderFileList();
        
        // Show success feedback
        deleteZone.style.animation = 'deleteSuccess 0.5s ease-out';
        setTimeout(() => {
            deleteZone.style.animation = '';
        }, 500);
    }
});

// Initial render
renderFileList();