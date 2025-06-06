const dropArea = document.getElementById('drop-area');
const fileElem = document.getElementById('fileElem');
const fileList = document.getElementById('file-list');
const addMoreBtn = document.getElementById('add-more');
const downloadBtn = document.getElementById('download');
const container = document.querySelector('.container');

let pdfFiles = [];

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
        
        fileInfo.appendChild(fileName);
        
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
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', idx);
            e.dataTransfer.setData('application/pdf-item', idx);
            
            // Show delete zone when dragging PDF items
            deleteZone.classList.add('show');
        });
        
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            // Hide delete zone when drag ends
            deleteZone.classList.remove('show');
            deleteZone.classList.remove('dragover');
        });
        
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
    } else {
        dropArea.classList.remove('hidden');
        addMoreBtn.style.display = 'none';
    }
}

function handleFiles(files) {
    let newFilesAdded = false;
    for (const file of files) {
        if (file.type === 'application/pdf') {
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
    if (pdfFiles.length > 0 && dragCounter === 1) {
        container.classList.add('dragover');
        dragOverlay.classList.add('show');
    }
});

container.addEventListener('dragleave', (e) => {
    dragCounter--;
    if (dragCounter === 0) {
        container.classList.remove('dragover');
        dragOverlay.classList.remove('show');
    }
});

container.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
});

container.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    container.classList.remove('dragover');
    dragOverlay.classList.remove('show');
    if (pdfFiles.length > 0) {
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
            pdfFiles.splice(index, 1);
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
    const pdfIndex = e.dataTransfer.getData('application/pdf-item');
    
    if (pdfIndex !== '' && pdfFiles[pdfIndex]) {
        console.log('Deleting PDF:', pdfFiles[pdfIndex].name);
        
        // Remove the PDF from array
        pdfFiles.splice(parseInt(pdfIndex), 1);
        
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