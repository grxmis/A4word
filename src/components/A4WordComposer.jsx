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

    const stop = () => {
      setDrag(false);
      setResize(false);
    };

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
        left: x,
        top: y,
        width,
        height,
        border: hideBorder ? "none" : "2px dashed #999",
        cursor: enabled ? "move" : "default",
        zIndex: 2
      }}
      onMouseDown={e => {
        if (!enabled) return;
        if (e.target.classList.contains("resize")) return;
        setDrag(true);
        start.current = {
          mx: e.clientX,
          my: e.clientY,
          box: { x, y, width, height }
        };
      }}
    >
      {children}
      {enabled && (
        <div
          className="resize"
          onMouseDown={e => {
            e.stopPropagation();
            setResize(true);
            start.current = {
              mx: e.clientX,
              my: e.clientY,
              box: { x, y, width, height }
            };
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
  const [docHtml, setDocHtml] = useState("");
  const [pages, setPages] = useState([]);
  const [fontSize, setFontSize] = useState(16);
  const [exporting, setExporting] = useState(false);
  const [libsReady, setLibsReady] = useState(false);

  const [box, setBox] = useState({
    x: 80,
    y: 120,
    width: 630,
    height: 850
  });

  const measureRef = useRef(null);

  /* =========================
        LOAD LIBRARIES
  ========================= */
  useEffect(() => {
    let loaded = 0;
    const libs = [
      "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
    ];

    libs.forEach(src => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => {
        loaded++;
        if (loaded === libs.length) setLibsReady(true);
      };
      document.body.appendChild(s);
    });
  }, []);

  /* =========================
           TEMPLATES
  ========================= */
  const templates = [
    { name: "Template 1", url: "/templates/template1.png" },
    { name: "Template 2", url: "/templates/template2.png" },
    { name: "Template 3", url: "/templates/template3.png" },
    { name: "Template 4", url: "/templates/template4.png" },
    { name: "Template 5", url: "/templates/template5.png" }
  ];

  /* =========================
           LOAD DOCX
  ========================= */
  const loadDoc = async file => {
    if (!libsReady) {
      alert("Φορτώνονται οι βιβλιοθήκες, περίμενε λίγο…");
      return;
    }
    if (!file?.name.endsWith(".docx")) return;

    const buffer = await file.arrayBuffer();
    const result = await window.mammoth.convertToHtml({
      arrayBuffer: buffer
    });

    setDocHtml(result.value);
    setPages([result.value]);
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
    let current = [];
    let result = [];

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
  const exportPDF = async preview => {
    setExporting(true);
    await new Promise(r => setTimeout(r, 200));

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");

    const els = document.querySelectorAll(".a4");
    for (let i = 0; i < els.length; i++) {
      const canvas = await window.html2canvas(els[i], { scale: 2 });
      if (i) pdf.addPage();
      pdf.addImage(canvas, "JPEG", 0, 0, 210, 297);
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
    <div className="p-4 bg-gray-100 min-h-screen">

      {/* HEADER */}
      <header className="bg-white p-4 rounded-xl shadow flex justify-between mb-4">
        <h1 className="font-black">A4 COMPOSER</h1>
        <div className="flex gap-2">
          <button onClick={() => exportPDF(true)}>Preview</button>
          <button onClick={() => exportPDF(false)}>Download</button>
        </div>
      </header>

      {/* TEMPLATE GALLERY */}
      <div className="flex gap-4 overflow-x-auto bg-white p-3 rounded shadow mb-4">
        {templates.map(t => (
          <div
            key={t.url}
            onClick={() => setTemplate(t.url)}
            style={{
              border: template === t.url ? "4px solid #2563eb" : "4px solid transparent",
              cursor: "pointer"
            }}
          >
            <img src={t.url} alt="" style={{ height: 160 }} />
          </div>
        ))}
      </div>

      {/* DOCX */}
      <input type="file" accept=".docx" onChange={e => loadDoc(e.target.files[0])} />

      {/* FONT */}
      <div className="my-4">
        <input
          type="range"
          min="10"
          max="40"
          value={fontSize}
          onChange={e => setFontSize(+e.target.value)}
        />
        <strong>{fontSize}px</strong>
      </div>

      {/* PAGES */}
      <div className="flex flex-col items-center gap-10">
        {pages.map((html, i) => (
          <div
            key={i}
            className="a4 relative bg-white shadow"
            style={{ width: A4_WIDTH, height: A4_HEIGHT }}
          >
            {template && (
              <img
                src={template}
                alt=""
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  zIndex: 1
                }}
              />
            )}

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
