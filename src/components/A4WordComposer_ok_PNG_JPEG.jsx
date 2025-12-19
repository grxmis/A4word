import React, { useState, useRef, useEffect, useCallback } from "react";

// A4 size at 96 DPI (standard resolution for desktop viewing)
const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

// --- Helper Component: Draggable & Resizable Box ---
function DraggableResizableBox({ x, y, width, height, onUpdate, children, disabled, hideBorder }) { 
  
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const startPos = useRef({ x: 0, y: 0, initialX: 0, initialY: 0, initialW: 0, initialH: 0 });

  // Logic for Dragging and Resizing
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (disabled || hideBorder) return;
      
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;

      if (isDragging) {
        onUpdate({ 
          x: startPos.current.initialX + dx, 
          y: startPos.current.initialY + dy, 
          width: startPos.current.initialW, 
          height: startPos.current.initialH 
        });
      } else if (isResizing) {
        onUpdate({ 
          x: startPos.current.initialX, 
          y: startPos.current.initialY, 
          width: Math.max(100, startPos.current.initialW + dx), 
          height: Math.max(100, startPos.current.initialH + dy) 
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, disabled, hideBorder, onUpdate]);

  const handleMouseDown = (e) => {
    if (disabled || hideBorder || e.target.closest('.resize-handle')) return;
    setIsDragging(true);
    startPos.current = { x: e.clientX, y: e.clientY, initialX: x, initialY: y, initialW: width, initialH: height };
  };

  const handleResizeStart = (e) => {
    if (disabled || hideBorder) return;
    e.stopPropagation();
    setIsResizing(true);
    startPos.current = { x: e.clientX, y: e.clientY, initialX: x, initialY: y, initialW: width, initialH: height };
  };

  const shouldHideBorders = disabled || hideBorder;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        // Διορθωμένο: Κρύβουμε το border αν disabled (σελίδα 2+) Ή αν hideBorder (εξαγωγή)
        border: shouldHideBorders ? 'none' : '2px dashed #999',
        cursor: shouldHideBorders ? 'default' : 'move',
        userSelect: 'none',
        zIndex: 10,
        backgroundColor: 'transparent'
      }}
      onMouseDown={handleMouseDown}
    >
      {children}
      {/* Κρύβουμε το handle αν πρέπει να κρυφτούν τα borders */}
      {!shouldHideBorders && (
        <div
          className="resize-handle"
          onMouseDown={handleResizeStart}
          style={{
            position: 'absolute',
            bottom: -5,
            right: -5,
            width: 15,
            height: 15,
            background: '#3b82f6',
            cursor: 'nwse-resize',
            borderRadius: '50%'
          }}
        />
      )}
    </div>
  );
}
// --- ΤΕΛΟΣ DraggableResizableBox ---

// --- Main Component ---
export default function A4WordComposer() {
  const [template, setTemplate] = useState(null);
  const [docHtml, setDocHtml] = useState("");
  const [fontSize, setFontSize] = useState(16);
  const [pages, setPages] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [libsLoaded, setLibsLoaded] = useState(false);
  
  const [isDragging, setIsDragging] = useState(false); 
  
  const [templateFileName, setTemplateFileName] = useState("Επιλέξτε αρχείο...");
  const [docFileName, setDocFileName] = useState("Επιλέξτε αρχείο...");

  const [box, setBox] = useState({ x: 80, y: 120, width: 630, height: 850 });
  const measureRef = useRef(null);

  const templateInputRef = useRef(null);
  const docInputRef = useRef(null);

  // 1. Φόρτωση εξωτερικών βιβλιοθηκών
  useEffect(() => {
    const scripts = [
      "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
    ];

    let loadedCount = 0;
    scripts.forEach(src => {
      if (document.querySelector(`script[src="${src}"]`)) {
        loadedCount++;
        if (loadedCount === scripts.length) setLibsLoaded(true);
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => {
        loadedCount++;
        if (loadedCount === scripts.length) setLibsLoaded(true);
      };
      document.body.appendChild(script);
    });
  }, []);

  // 2. Λογική χειρισμού αρχείων (Template & Docx)
  function handleTemplate(fileOrEvent) {
    const file = fileOrEvent.target?.files?.[0] || fileOrEvent;
    if (!file || !file.type.startsWith("image/")) return;
    setTemplateFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = () => setTemplate(reader.result);
    reader.readAsDataURL(file);
  }

  async function handleDoc(fileOrEvent) {
    if (!window.mammoth) {
      console.error("Mammoth library not loaded.");
      return;
    }
    const file = fileOrEvent.target?.files?.[0] || fileOrEvent;
    if (!file) return;
    setDocFileName(file.name);
    
    try {
        const buffer = await file.arrayBuffer();
        const result = await window.mammoth.convertToHtml({ arrayBuffer: buffer });
        setDocHtml(result.value || "");
    } catch (error) {
      console.error("Error converting DOCX:", error);
    }
  }

  function handleReset() {
    setTemplate(null);
    setDocHtml("");
    setPages([]);
    setFontSize(16);
    setTemplateFileName("Επιλέξτε αρχείο...");
    setDocFileName("Επιλέξτε αρχείο...");
    if (templateInputRef.current) templateInputRef.current.value = null;
    if (docInputRef.current) docInputRef.current.value = null;
  }
  
  // 3. Λογική σελιδοποίησης (Pagination Logic - Παραμένει ίδια)
  useEffect(() => {
    if (!docHtml || !measureRef.current) {
      setPages([]);
      return;
    }
    const container = measureRef.current;
    container.innerHTML = docHtml;
    container.style.fontSize = fontSize + "px";
    container.style.width = box.width + "px";
    container.style.margin = "0";
    container.style.padding = "0";
    container.style.lineHeight = "1.4"; 

    const elements = Array.from(container.children);
    elements.forEach(el => { el.style.margin = '0'; el.style.padding = '0'; });

    const newPages = [];
    let remainingElements = [...elements];
    
    while (remainingElements.length > 0) {
        let currentPageNodes = [];
        let elementsToProcess = [...remainingElements];
        remainingElements = [];
        container.innerHTML = '';
        let breakPage = false;

        for (let i = 0; i < elementsToProcess.length; i++) {
            if (breakPage) {
                remainingElements.push(elementsToProcess[i]);
                continue;
            }

            const el = elementsToProcess[i];
            const clone = el.cloneNode(true);
            container.appendChild(clone);
            
            if (container.scrollHeight <= box.height) {
                currentPageNodes.push(clone);
            } else {
                container.removeChild(clone);

                if (el.tagName === 'P') {
                    const words = el.textContent.split(/\s+/).filter(w => w.length > 0);
                    let leftWords = [];
                    let rightWords = [];
                    const tempSplitter = el.cloneNode(true); 
                    tempSplitter.textContent = '';
                    container.appendChild(tempSplitter);

                    for (let w = 0; w < words.length; w++) {
                        leftWords.push(words[w]);
                        tempSplitter.textContent = leftWords.join(' ');
                        
                        if (container.scrollHeight > box.height) {
                            leftWords.pop(); 
                            rightWords = words.slice(w); 
                            
                            const currentFragment = el.cloneNode(true);
                            currentFragment.textContent = leftWords.join(' ');
                            currentPageNodes.push(currentFragment);
                            
                            const nextFragment = el.cloneNode(true);
                            nextFragment.textContent = rightWords.join(' ');
                            remainingElements.push(nextFragment);
                            
                            breakPage = true; 
                            break; 
                        }
                    }
                    container.removeChild(tempSplitter);
                } else {
                    remainingElements.push(el);
                    breakPage = true; 
                }
            }
            
            if (breakPage && i < elementsToProcess.length - 1) {
                remainingElements.push(...elementsToProcess.slice(i + 1));
            }

            if (breakPage) break; 
        }
        newPages.push(currentPageNodes.map((n) => n.outerHTML).join(""));
    }
    setPages(newPages);
  }, [docHtml, fontSize, box.width, box.height]);
  
  // 4. Βοηθητική συνάρτηση λήψης Canvas (για εξαγωγή)
  const getPageCanvas = useCallback(async (pageEl) => {
    return await window.html2canvas(pageEl, {
        scale: 2, // Διπλή ανάλυση για καλύτερη ποιότητα στο PDF
        logging: false,
        useCORS: true,
        scrollY: 0,
        scrollX: 0, 
        allowTaint: true 
    });
  }, []);


  // 5. Λογική Εξαγωγής PDF (Διορθωμένη)
  async function exportPDF() {
    if (!window.html2canvas || !window.jspdf || pages.length === 0) return;

    setIsExporting(true);
    
    // Αναμονή για ενημέρωση του DOM (αφαίρεση borders)
    await new Promise(resolve => setTimeout(resolve, 50)); 

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4'); 

        // A4 διαστάσεις σε μονάδες mm 
        const pdfWidth = 210;
        const pdfHeight = 297;
        
        const pageElements = document.querySelectorAll('.a4-page');

        for (let i = 0; i < pageElements.length; i++) {
            const pageEl = pageElements[i];

            const canvas = await getPageCanvas(pageEl);

            // Χρησιμοποιούμε Data URL της εικόνας
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            
            // Προσθήκη σελίδας ΜΟΝΟ αν δεν είναι η πρώτη
            if (i > 0) {
                pdf.addPage(pdfWidth, pdfHeight); 
            }
            
            // Εισάγουμε την εικόνα καλύπτοντας όλο το A4
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        }

        // Διαγραφή της κενής σελίδας (μόνο αν υπήρχε content)
        // Εφόσον προσθέσαμε την εικόνα στην πρώτη σελίδα, η αρχική κενή
        // θεωρείται πλέον η πρώτη σελίδα μας.
        // Αντί να διαγράψουμε, θα κάνουμε απλά save. 
        // 🚨 Αν το PDF έχει μια κενή πρώτη σελίδα, αφαιρέστε τα σχόλια από την παρακάτω γραμμή
        // pdf.deletePage(1); 


        pdf.save('document_combined.pdf');

    } catch (error) {
        console.error("PDF Export Error:", error);
        alert('Αποτυχία εξαγωγής PDF. Ελέγξτε την κονσόλα.');
    } finally {
        setIsExporting(false); 
    }
  }

  // 6. Λογική Εξαγωγής Εικόνων (Λειτουργεί)
  async function exportImages(type) {
    if (!window.html2canvas || pages.length === 0) return;

    setIsExporting(true);
    await new Promise(resolve => setTimeout(resolve, 50)); 

    try {
        const pageElements = document.querySelectorAll('.a4-page');
        const mimeType = type === 'png' ? 'image/png' : 'image/jpeg';

        for (let i = 0; i < pageElements.length; i++) {
            const pageEl = pageElements[i];

            const canvas = await getPageCanvas(pageEl);

            const imgData = canvas.toDataURL(mimeType, 1.0);
            
            const link = document.createElement('a');
            link.href = imgData;
            link.download = `page_${i + 1}.${type}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    } catch (error) {
        console.error(`Image Export (${type}) Error:`, error);
    } finally {
        setIsExporting(false);
    }
  }
  
  // 7. Drag & Drop Logic (Παραμένει ίδια)
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isFileDrag = Array.from(e.dataTransfer.types).includes("Files");
    if (e.type === "dragenter" || e.type === "dragover") {
      if (isFileDrag) {
        setIsDragging(true);
      }
    } else if (e.type === "dragleave") {
      if (!e.currentTarget.contains(e.relatedTarget)) {
        setIsDragging(false);
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      
      files.forEach(file => {
        const fileType = file.type;
        
        if (fileType.startsWith("image/")) {
          handleTemplate(file);
        } else if (file.name.endsWith(".docx")) {
          handleDoc(file);
        }
      });
      e.dataTransfer.clearData();
    }
  };
  
  if (!libsLoaded) {
      return <div className="p-10 text-center">Φόρτωση βιβλιοθηκών...</div>;
  }

  return (
    <div 
      className="font-sans p-5 bg-gray-100 min-h-screen relative"
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      
      {/* Κεφαλίδα εφαρμογής */}
      <header className="mb-6 py-4 bg-white shadow-md rounded-lg flex justify-between items-center px-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
          📝 A4 Document Composer
        </h1>
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition duration-150 flex items-center gap-2 text-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
          Καθαρισμός / Επαναφορά
        </button>
      </header>
      
      {/* Κουμπιά Export */}
      <div className="mb-6 flex flex-wrap gap-4 bg-white p-4 rounded shadow">
        <button 
          onClick={exportPDF}
          disabled={pages.length === 0 || isExporting}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 transition duration-150 flex items-center gap-2 font-bold"
        >
          {isExporting ? 'Εξαγωγή...' : 'Εξαγωγή σε PDF'}
        </button>
        <button 
          onClick={() => exportImages('png')}
          disabled={pages.length === 0 || isExporting}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400 transition duration-150 flex items-center gap-2"
        >
          Εξαγωγή σε PNG
        </button>
        <button 
          onClick={() => exportImages('jpeg')}
          disabled={pages.length === 0 || isExporting}
          className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:bg-gray-400 transition duration-150 flex items-center gap-2"
        >
          Εξαγωγή σε JPEG
        </button>
      </div>

      {/* Input Fields και Font Size Control */}
      <div className="flex gap-5 flex-wrap mb-6 bg-white p-4 rounded shadow">
        
        <label className="flex flex-col gap-1 text-sm font-medium w-48 bg-gray-50 p-2 rounded border border-gray-300 cursor-pointer">
          <span className="text-gray-700">📄 Template (JPEG/PNG):</span>
          <span className={`text-xs truncate ${templateFileName === "Επιλέξτε αρχείο..." ? 'text-gray-500' : 'text-green-700 font-semibold'}`}>
            {templateFileName}
          </span>
          <input 
             type="file" 
             accept="image/*" 
             onChange={handleTemplate} 
             className="hidden"
             ref={templateInputRef} 
          />
        </label>
        
        <label className="flex flex-col gap-1 text-sm font-medium w-48 bg-gray-50 p-2 rounded border border-gray-300 cursor-pointer">
          <span className="text-gray-700">📝 Word (.docx):</span>
          <span className={`text-xs truncate ${docFileName === "Επιλέξτε αρχείο..." ? 'text-gray-500' : 'text-green-700 font-semibold'}`}>
            {docFileName}
          </span>
          <input 
             type="file" 
             accept=".docx" 
             onChange={handleDoc} 
             className="hidden"
             ref={docInputRef} 
          />
        </label>
        
        <label className="flex flex-col gap-1 text-sm font-medium w-48">
          🔠 Μέγεθος κειμένου: {fontSize}px
          <input 
            type="range" 
            min="10" 
            max="40" 
            value={fontSize} 
            onChange={(e) => setFontSize(Number(e.target.value))} 
            className="w-full"
          />
        </label>
      </div>

      <div className="flex flex-col items-center gap-8">
        {/* Page Rendering */}
        {pages.map((html, i) => (
            <div
                key={i}
                id={`page-${i}`}
                className="relative bg-white shadow-2xl a4-page" 
                style={{
                    width: A4_WIDTH,
                    height: A4_HEIGHT,
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Template Background */}
                {template && (
                    <img 
                        src={template} 
                        alt={`Template Page ${i + 1}`} 
                        className="absolute top-0 left-0 w-full h-full object-cover pointer-events-none"
                    />
                )}
                
                {/* Draggable Content Box */}
                <DraggableResizableBox 
                    x={box.x} 
                    y={box.y} 
                    width={box.width} 
                    height={box.height} 
                    onUpdate={setBox}
                    disabled={i > 0} 
                    hideBorder={isExporting} // Κρύβουμε το border κατά την εξαγωγή
                >
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            overflow: 'hidden',
                            fontSize: `${fontSize}px`,
                            color: '#333',
                            lineHeight: '1.4',
                        }}
                        dangerouslySetInnerHTML={{ __html: html }}
                    />
                </DraggableResizableBox>
            </div>
        ))}
        
        {pages.length === 0 && (
            <div 
                className="flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded"
                style={{ width: A4_WIDTH, height: 400 }}
            >
                Ανεβάστε ένα αρχείο Word για προεπισκόπηση
            </div>
        )}
      </div>

      {/* Hidden container for measuring text flow */}
      <div
        ref={measureRef}
        style={{
          position: 'absolute',
          visibility: 'hidden',
          whiteSpace: 'normal',
          wordBreak: 'break-word',
          pointerEvents: 'none',
          height: 'auto',
          boxSizing: 'border-box',
          zIndex: -1,
          top: 0,
          left: 0,
        }}
      />
      
      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-blue-500 bg-opacity-10 backdrop-blur-sm pointer-events-none"
        >
          <p className="text-3xl font-bold text-blue-700 p-8 border-4 border-dashed border-blue-700 rounded-lg">
            Αφήστε τα αρχεία (.docx / image) εδώ!
          </p>
        </div>
      )}

    </div>
  );
}