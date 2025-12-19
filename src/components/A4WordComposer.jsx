import React, { useState, useRef, useEffect } from "react";

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

/* ===============================
   DRAGGABLE + RESIZABLE BOX
================================ */
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
          width: Math.max(120, start.current.box.width + dx),
          height: Math.max(120, start.current.box.height + dy)
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
        zIndex: 5
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

/* ===============================
            MAIN APP
================================ */
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

  /* ===============================
      LOAD EXTERNAL LIBRARIES
================================ */
  useEffect(() => {
    let loaded = 0;
    [
      "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
    ].forEach(src => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => {
        loaded++;
        if (loaded === 3) setLibsReady(true);
      };
      document.body.appendChild(s);
    });
  }, []);

  /* ===============================
            TEMPLATES
================================ */
  const templates = [1, 2, 3, 4, 5].map(i => ({
    name: `Template ${i}`,
    url: `/templates/template${i}.png`
  }));

  /* ===============================
          LOAD WORD FILE
================================ */
  const loadDoc = async file => {
    if (!libsReady || !file) return;
    const buffer = await file.arrayBuffer();
    const result = await window.mammoth.convertToHtml({ arrayBuffer: buffer });
    setDocHtml(result.value);
    setPages([result.value]);
  };

  /* ===============================
            PAGINATION
================================ */
  useEffect(() => {
    if (!docHtml || !measureRef.current) return;

    const c = measureRef.current;
    c.style.width = box.width + "px";
    c.style.fontSize = fontSize + "px";
    c.innerHTML = docHtml;

    const nodes = Array.from(c.children);
    let current = [];
    let result = [];
    c.innerHTML = "";

    for (let n of nodes) {
      c.appendChild(n.cloneNode(true));
      if (c.scrollHeight > box.height) {
        c.innerHTML = "";
        result.push(current.join(""));
        current = [n.outerHTML];
        c.innerHTML = n.outerHTML;
      } else {
        current.push(n.outerHTML);
      }
    }
    if (current.length) result.push(current.join(""));
    setPages(result);
  }, [docHtml, fontSize, box.width, box.height]);

  /* ===============================
              RESET
================================ */
  const resetAll = () => {
    setTemplate(null);
    setDocHtml("");
    setPages([]);
    setFontSize(16);
    setBox({ x: 80, y: 120, width: 630, height: 850 });
  };

  /* ===============================
              PDF
================================ */
  const exportPDF = async preview => {
    setExporting(true);
    await new Promise(r => setTimeout(r, 200));

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");

    const pagesEls = document.querySelectorAll(".a4");
    for (let i = 0; i < pagesEls.length; i++) {
      const canvas = await window.html2canvas(pagesEls[i], { scale: 2 });
      if (i) pdf.addPage();
      pdf.addImage(canvas, "JPEG", 0, 0, 210, 297);
    }

    setExporting(false);
    preview
      ? window.open(URL.createObjectURL(pdf.output("blob")))
      : pdf.save("document.pdf");
  };

  /* ===============================
                UI
================================ */
  return (
    <div className="min-h-screen bg-gray-100 p-4 flex gap-4">

      {/* LEFT – TEMPLATES */}
      <div className="w-48 bg-white rounded-xl shadow p-2 flex flex-col gap-2 overflow-y-auto">
        <div className="font-bold text-center">Templates</div>

        {templates.map(t => (
          <button
            key={t.url}
            onClick={() => setTemplate(t.url)}
            style={{
              padding: 4,
              borderRadius: 6,
              border: template === t.url ? "2px solid #2563eb" : "1px solid #ccc",
              background: "white",
              cursor: "pointer"
            }}
          >
            <img
              src={t.url}
              alt={t.name}
              style={{ width: "100%", display: "block" }}
            />
          </button>
        ))}
      </div>

      {/* RIGHT – CONTENT */}
      <div className="flex-1">

        {/* CONTROLS */}
        <div className="bg-white rounded-xl shadow p-3 mb-4 flex flex-wrap items-center gap-4">
          <input type="file" accept=".docx" onChange={e => loadDoc(e.target.files[0])} />

          <label className="flex items-center gap-2">
            Font
            <input
              type="range"
              min="10"
              max="40"
              value={fontSize}
              onChange={e => setFontSize(+e.target.value)}
            />
            <strong>{fontSize}px</strong>
          </label>

          <button onClick={resetAll}>Reset</button>
          <button onClick={() => exportPDF(true)}>Preview</button>
          <button onClick={() => exportPDF(false)}>Download</button>
        </div>

        {/* A4 PAGES */}
        <div className="flex flex-col items-center gap-10">
          {pages.map((html, i) => (
            <div
              key={i}
              className="a4 relative bg-white shadow-xl"
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
                    objectFit: "cover"
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
      </div>

      <div ref={measureRef} style={{ position: "absolute", visibility: "hidden" }} />
    </div>
  );
}
