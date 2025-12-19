import React, { useState, useRef, useEffect } from "react";

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

/* =========================
   Draggable & Resizable Box
========================= */
function DraggableResizableBox({
  x, y, width, height, onUpdate, children,
  disabled, hideBorder
}) {
  const [drag, setDrag] = useState(false);
  const [resize, setResize] = useState(false);
  const start = useRef({});

  const enabled = !disabled && !hideBorder;

  useEffect(() => {
    const move = e => {
      if (!enabled) return;
      const dx = e.clientX - start.current.mx;
      const dy = e.clientY - start.current.my;

      if (drag) {
        onUpdate({
          ...start.current.box,
          x: start.current.box.x + dx,
          y: start.current.box.y + dy
        });
      }
      if (resize) {
        onUpdate({
          ...start.current.box,
          width: Math.max(100, start.current.box.width + dx),
          height: Math.max(100, start.current.box.height + dy)
        });
      }
    };

    const stop = () => { setDrag(false); setResize(false); };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
    };
  }, [drag, resize, enabled, onUpdate]);

  return (
    <div
      style={{
        position: "absolute",
        left: x, top: y,
        width, height,
        border: hideBorder ? "none" : "2px dashed #999",
        cursor: enabled ? "move" : "default",
        zIndex: 10
      }}
      onMouseDown={e => {
        if (!enabled) return;
        if (e.target.classList.contains("resize")) return;
        setDrag(true);
        start.current = { mx: e.clientX, my: e.clientY, box: { x, y, width, height } };
      }}
    >
      {children}
      {enabled && (
        <div
          className="resize"
          onMouseDown={e => {
            e.stopPropagation();
            setResize(true);
            start.current = { mx: e.clientX, my: e.clientY, box: { x, y, width, height } };
          }}
          style={{
            position: "absolute",
            right: -6,
            bottom: -6,
            width: 14,
            height: 14,
            background: "#2563eb",
            borderRadius: "50%",
            cursor: "nwse-resize"
          }}
        />
      )}
    </div>
  );
}

/* =========================
        MAIN APP
========================= */
export default function A4Composer() {

  const [template, setTemplate] = useState(null);
  const [templateName, setTemplateName] = useState("Επιλέξτε εικόνα...");
  const [docName, setDocName] = useState("Επιλέξτε .docx...");
  const [docHtml, setDocHtml] = useState("");
  const [pages, setPages] = useState([]);
  const [fontSize, setFontSize] = useState(16);
  const [exporting, setExporting] = useState(false);
  const [dragging, setDragging] = useState(false);

  const [box, setBox] = useState({ x: 80, y: 120, width: 630, height: 850 });
  const measureRef = useRef(null);

  /* =========================
       Load external libs
  ========================= */
  useEffect(() => {
    ["mammoth.browser.min.js", "html2canvas.min.js", "jspdf.umd.min.js"]
      .forEach(src => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/" +
          (src.includes("mammoth") ? "mammoth/1.6.0/" :
           src.includes("html2canvas") ? "html2canvas/1.4.1/" :
           "jspdf/2.5.1/") + src;
        document.body.appendChild(s);
      });
  }, []);

  /* =========================
          FILE HANDLERS
  ========================= */
  const loadTemplate = file => {
    if (!file?.type.startsWith("image/")) return;
    setTemplateName(file.name);
    const r = new FileReader();
    r.onload = () => setTemplate(r.result);
    r.readAsDataURL(file);
    if (pages.length === 0) setPages([""]);
  };

  const loadDoc = async file => {
    if (!file?.name.endsWith(".docx")) return;
    setDocName(file.name);
    const buf = await file.arrayBuffer();
    const res = await window.mammoth.convertToHtml({ arrayBuffer: buf });
    setDocHtml(res.value);
    setPages([res.value]);
  };

  /* =========================
         DRAG & DROP
  ========================= */
  const onDrop = e => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (!f) return;
    if (f.type.startsWith("image/")) loadTemplate(f);
    else if (f.name.endsWith(".docx")) loadDoc(f);
  };

  /* =========================
        PAGINATION
  ========================= */
  useEffect(() => {
    if (!docHtml || !measureRef.current) return;

    const container = measureRef.current;
    container.style.width = box.width + "px";
    container.style.fontSize = fontSize + "px";
    container.innerHTML = docHtml;

    const nodes = Array.from(container.children);
    let current = [], result = [];

    container.innerHTML = "";
    for (let n of nodes) {
      container.appendChild(n.cloneNode(true));
      if (container.scrollHeight > box.height) {
        container.innerHTML = "";
        result.push(current.join(""));
        current = [n.outerHTML];
        container.innerHTML = n.outerHTML;
      } else {
        current.push(n.outerHTML);
      }
    }
    if (current.length) result.push(current.join(""));
    setPages(result);
  }, [docHtml, fontSize, box.width, box.height]);

  /* =========================
            PDF
  ========================= */
  const exportPDF = async (preview) => {
    setExporting(true);
    await new Promise(r => setTimeout(r, 200));

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");

    const els = document.querySelectorAll(".a4");
    for (let i = 0; i < els.length; i++) {
      const c = await window.html2canvas(els[i], { scale: 2 });
      if (i) pdf.addPage();
      pdf.addImage(c, "JPEG", 0, 0, 210, 297);
    }
    setExporting(false);

    preview
      ? window.open(URL.createObjectURL(pdf.output("blob")))
      : pdf.save("document.pdf");
  };

  /* =========================
              UI
  ========================= */
  return (
    <div
      className="p-4 bg-gray-100 min-h-screen"
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDrop={onDrop}
      onDragLeave={() => setDragging(false)}
    >

      {dragging && (
        <div className="fixed inset-0 bg-blue-500/20 border-4 border-dashed border-blue-600 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl font-bold">Ρίξτε αρχείο εδώ</div>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-white p-4 rounded-xl shadow flex justify-between mb-4">
        <h1 className="font-black">A4 COMPOSER</h1>
        <div className="flex gap-2">
          <button onClick={() => location.reload()} className="px-3 py-2 bg-red-100 rounded">Reset</button>
          <button onClick={() => exportPDF(true)} className="px-3 py-2 bg-gray-800 text-white rounded">Preview</button>
          <button onClick={() => exportPDF(false)} className="px-3 py-2 bg-blue-600 text-white rounded">Download</button>
        </div>
      </header>

      {/* FILES */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <label className="border-2 border-dashed p-3 rounded cursor-pointer">
          🖼️ {templateName}
          <input hidden type="file" accept="image/*" onChange={e => loadTemplate(e.target.files[0])}/>
        </label>
        <label className="border-2 border-dashed p-3 rounded cursor-pointer">
          📄 {docName}
          <input hidden type="file" accept=".docx" onChange={e => loadDoc(e.target.files[0])}/>
        </label>
      </div>

      {/* FONT */}
      <div className="bg-white p-4 rounded mb-6">
        <input type="range" min="10" max="40" value={fontSize}
          onChange={e => setFontSize(+e.target.value)} />
        <div className="text-center font-bold">{fontSize}px</div>
      </div>

      {/* PAGES */}
      <div className="flex flex-col items-center gap-10">
        {pages.map((html, i) => (
          <div key={i} className="a4 relative bg-white shadow-2xl"
               style={{ width: A4_WIDTH, height: A4_HEIGHT }}>
            {template && <img src={template} className="absolute inset-0 w-full h-full object-cover" alt="" />}
            <DraggableResizableBox
              {...box}
              onUpdate={setBox}
              disabled={i > 0}
              hideBorder={exporting}
            >
              <div
                style={{ fontSize, lineHeight: 1.4 }}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </DraggableResizableBox>
          </div>
        ))}
      </div>

      <div ref={measureRef} style={{ position: "absolute", visibility: "hidden" }} />
    </div>
  );
}
