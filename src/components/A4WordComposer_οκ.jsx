import React, { useState, useRef, useEffect, useCallback } from "react";

// A4 size at 96 DPI
const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

// --- Helper Component: Draggable & Resizable Box ---
function DraggableResizableBox({ x, y, width, height, onUpdate, children, disabled, hideBorder }) { 
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const startPos = useRef({ x: 0, y: 0, initialX: 0, initialY: 0, initialW: 0, initialH: 0 });

    const isInteractionEnabled = !disabled && !hideBorder;

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isInteractionEnabled) return;
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
    }, [isDragging, isResizing, isInteractionEnabled, onUpdate, x, y, width, height]);

    const handleMouseDown = (e) => {
        if (!isInteractionEnabled || e.target.closest('.resize-handle')) return;
        setIsDragging(true);
        startPos.current = { x: e.clientX, y: e.clientY, initialX: x, initialY: y, initialW: width, initialH: height };
    };

    const handleResizeStart = (e) => {
        if (!isInteractionEnabled) return;
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
                border: shouldHideBorders ? 'none' : '2px dashed #999',
                cursor: shouldHideBorders ? 'default' : 'move',
                userSelect: 'none',
                zIndex: 10,
                backgroundColor: 'transparent'
            }}
            onMouseDown={handleMouseDown}
        >
            {children}
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
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    const measureRef = useRef(null);
    const templateInputRef = useRef(null);
    const docInputRef = useRef(null);

    // Load External Libs
    useEffect(() => {
        const scripts = [
            "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js",
            "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
            "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
        ];
        let loadedCount = 0;
        scripts.forEach(src => {
            const script = document.createElement("script");
            script.src = src;
            script.onload = () => {
                loadedCount++;
                if (loadedCount === scripts.length) setLibsLoaded(true);
            };
            document.body.appendChild(script);
        });
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Helper: Calculate pages without rendering to UI
    const calculatePageCount = useCallback((htmlContent, currentFontSize, currentBox) => {
        if (!htmlContent || !measureRef.current) return 0;
        const container = measureRef.current;
        container.innerHTML = htmlContent;
        container.style.fontSize = currentFontSize + "px";
        container.style.width = currentBox.width + "px";
        container.style.lineHeight = "1.4";
        const elements = Array.from(container.children);
        let count = 0;
        let remaining = [...elements];
        while (remaining.length > 0) {
            count++;
            container.innerHTML = '';
            let breakPage = false;
            for (let i = 0; i < remaining.length; i++) {
                const clone = remaining[i].cloneNode(true);
                container.appendChild(clone);
                if (container.scrollHeight > currentBox.height) {
                    remaining = remaining.slice(i);
                    breakPage = true;
                    break;
                }
            }
            if (!breakPage) remaining = [];
        }
        return count;
    }, []);

    // Pagination Effect
    useEffect(() => {
        if (!docHtml || !measureRef.current) { setPages([]); return; }
        const container = measureRef.current;
        container.innerHTML = docHtml;
        container.style.fontSize = fontSize + "px";
        container.style.width = box.width + "px";
        const elements = Array.from(container.children);
        let newPages = [];
        let remaining = [...elements];
        while (remaining.length > 0) {
            let pageNodes = [];
            container.innerHTML = '';
            let breakIdx = remaining.length;
            for (let i = 0; i < remaining.length; i++) {
                const clone = remaining[i].cloneNode(true);
                container.appendChild(clone);
                if (container.scrollHeight <= box.height) {
                    pageNodes.push(clone.outerHTML);
                } else {
                    breakIdx = i;
                    break;
                }
            }
            newPages.push(pageNodes.join(""));
            remaining = remaining.slice(breakIdx);
            if (breakIdx === 0 && remaining.length > 0) break; // prevent infinite loop
        }
        setPages(newPages);
    }, [docHtml, fontSize, box.width, box.height]);

    // AI Optimize Font Size
    async function optimizeFontSize(target = 1) {
        let low = 10, high = 40, best = fontSize;
        for (let i = 0; i < 6; i++) {
            let mid = (low + high) / 2;
            if (calculatePageCount(docHtml, mid, box) <= target) {
                best = mid; low = mid;
            } else { high = mid; }
        }
        setFontSize(Math.floor(best));
    }

    // PDF Core Logic (Shared for Export & Preview)
    async function generatePDFBlob() {
        setIsExporting(true);
        await new Promise(r => setTimeout(r, 100));
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageEls = document.querySelectorAll('.a4-page');
        for (let i = 0; i < pageEls.length; i++) {
            const canvas = await window.html2canvas(pageEls[i], { scale: 2 });
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            if (i > 0) pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
        }
        setIsExporting(false);
        return pdf.output('blob');
    }

    const handlePreview = async () => {
        const blob = await generatePDFBlob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    };

    const handleDownloadPDF = async () => {
        const blob = await generatePDFBlob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = "document.pdf";
        link.click();
    };

    const handleFile = (e, type) => {
        const file = e.target.files[0];
        if (!file) return;
        if (type === 'img') {
            setTemplateFileName(file.name);
            const r = new FileReader(); r.onload = () => setTemplate(r.result); r.readAsDataURL(file);
        } else {
            setDocFileName(file.name);
            file.arrayBuffer().then(buf => window.mammoth.convertToHtml({arrayBuffer: buf}))
                .then(res => setDocHtml(res.value));
        }
    };

    if (!libsLoaded) return <div className="p-10 text-center font-bold">Φόρτωση βιβλιοθηκών...</div>;

    return (
        <div className="p-4 bg-gray-100 min-h-screen">
            <style>
                {`
                @media (max-width: 768px) {
                    .a4-page-scaled {
                        transform: scale(0.45); 
                        transform-origin: top center; 
                        margin-bottom: -550px; 
                        box-shadow: none !important;
                    }
                }
                `}
            </style>

            <header className="flex flex-col md:flex-row justify-between items-center bg-white p-4 shadow rounded-lg mb-4 gap-4">
                <h1 className="text-xl font-bold italic">📝 Document Composer</h1>
                <div className="flex gap-2">
                    <button onClick={() => setPages([])} className="bg-red-500 text-white px-3 py-1 rounded text-sm">Reset</button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-white p-4 rounded shadow flex flex-col gap-2">
                    <span className="text-xs font-bold uppercase">1. Αρχεία</span>
                    <label className="border p-2 rounded text-xs cursor-pointer truncate bg-gray-50">
                        🖼️ {templateFileName}
                        <input type="file" className="hidden" onChange={(e)=>handleFile(e, 'img')} accept="image/*" />
                    </label>
                    <label className="border p-2 rounded text-xs cursor-pointer truncate bg-gray-50">
                        📄 {docFileName}
                        <input type="file" className="hidden" onChange={(e)=>handleFile(e, 'doc')} accept=".docx" />
                    </label>
                </div>

                <div className="bg-white p-4 rounded shadow flex flex-col gap-2">
                    <span className="text-xs font-bold uppercase">2. Ρυθμίσεις</span>
                    <div className="flex items-center justify-between">
                        <span className="text-sm">Μέγεθος: {fontSize}px</span>
                        <button onClick={()=>optimizeFontSize(1)} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded border border-purple-300 font-bold">✨ Auto-fit (1 Σελ.)</button>
                    </div>
                    <input type="range" min="10" max="40" value={fontSize} onChange={(e)=>setFontSize(Number(e.target.value))} />
                </div>

                <div className="bg-white p-4 rounded shadow flex flex-col gap-2">
                    <span className="text-xs font-bold uppercase">3. Εξαγωγή</span>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={handlePreview} disabled={isExporting || pages.length===0} className="bg-gray-800 text-white py-2 rounded text-sm font-bold">👁️ Preview</button>
                        <button onClick={handleDownloadPDF} disabled={isExporting || pages.length===0} className="bg-blue-600 text-white py-2 rounded text-sm font-bold">📥 PDF</button>
                    </div>
                </div>
            </div>

            {isMobile && (
                <div className="bg-blue-50 p-4 rounded mb-4 text-xs grid grid-cols-2 gap-2 shadow-inner">
                    <label>X: <input type="number" value={box.x} onChange={e=>setBox({...box, x:Number(e.target.value)})} className="w-full border p-1"/></label>
                    <label>Y: <input type="number" value={box.y} onChange={e=>setBox({...box, y:Number(e.target.value)})} className="w-full border p-1"/></label>
                    <label>W: <input type="number" value={box.width} onChange={e=>setBox({...box, width:Number(e.target.value)})} className="w-full border p-1"/></label>
                    <label>H: <input type="number" value={box.height} onChange={e=>setBox({...box, height:Number(e.target.value)})} className="w-full border p-1"/></label>
                </div>
            )}

            <div className="flex flex-col items-center gap-8 py-4">
                {pages.map((html, i) => (
                    <div key={i} className={`relative bg-white shadow-2xl overflow-hidden a4-page ${isMobile ? 'a4-page-scaled' : ''}`} 
                         style={{ width: A4_WIDTH, height: A4_HEIGHT }}>
                        {template && <img src={template} className="absolute inset-0 w-full h-full object-cover pointer-events-none" alt="bg" />}
                        <DraggableResizableBox x={box.x} y={box.y} width={box.width} height={box.height} onUpdate={setBox} disabled={i>0 || isMobile} hideBorder={isExporting}>
                            <div className="w-full h-full overflow-hidden" style={{ fontSize: `${fontSize}px`, lineHeight: "1.4" }} dangerouslySetInnerHTML={{ __html: html }} />
                        </DraggableResizableBox>
                        <div className="absolute bottom-2 right-4 text-[10px] text-gray-400">Σελίδα {i+1}</div>
                    </div>
                ))}
            </div>

            <div ref={measureRef} style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none', top: 0 }} />
        </div>
    );
}