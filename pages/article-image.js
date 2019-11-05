import { useRouter } from "next/router";
import React, { useCallback, useState, useEffect, useRef } from "react";
import { SketchPicker } from "react-color";
import getGrid from "../lib/rule110";

function createState(
  router,
  name,
  initialValue,
  { parseQuery = v => v, valueFromEvent = e => e.target.value } = {}
) {
  const [val, setVal] = useState(initialValue);

  useEffect(() => {
    if (router.query[name]) {
      setVal(parseQuery(router.query[name]));
    }
  }, [router.query[name]]);

  const onChange = useCallback(e => {
    setVal(valueFromEvent(e));
  }, []);

  return [val, onChange];
}

const Page = () => {
  const router = useRouter();
  const canvas = useRef();

  const [title, titleChanged] = createState(router, "title", "", {
    parseQuery: q => q.replace(/\\n/g, "\n")
  });
  const [imgSrc, imgSrcChanged] = createState(router, "img", "");
  const [authorImgSrc, authorImgSrcChanged] = createState(
    router,
    "author-img",
    ""
  );
  const [width, widthChanged] = createState(router, "w", 600, {
    parseQuery: s => parseInt(s, 10)
  });
  const [height, heightChanged] = createState(router, "h", 600, {
    parseQuery: s => parseInt(s, 10)
  });
  const [foregroundColor, foregroundColorChanged] = createState(
    router,
    "fg",
    "black",
    {
      valueFromEvent: color => color.hex
    }
  );
  const [backgroundColor, backgroundColorChanged] = createState(
    router,
    "bg",
    "white",
    {
      valueFromEvent: color => color.hex
    }
  );

  const [img, setImg] = useState(null);
  const [authorImg, setAuthorImg] = useState(null);

  useEffect(() => {
    (async () => {
      if (imgSrc) {
        const img = await getImage(imgSrc);
        setImg(img);
      }
    })();
  }, [imgSrc]);

  useEffect(() => {
    (async () => {
      if (authorImgSrc) {
        const img = await getImage(authorImgSrc);
        setAuthorImg(img);
      }
    })();
  }, [authorImgSrc]);

  useEffect(() => {
    const grid = getGrid(30, 70);
    if (!img) {
      return;
    }
    if (!canvas.current) {
      return;
    }
    loadAndPaintImage(
      canvas.current,
      title,
      img,
      authorImg,
      router.query.gravity,
      backgroundColor,
      foregroundColor,
      grid
    );
  }, [
    width,
    height,
    canvas.current,
    title,
    img,
    router.query.gravity,
    authorImg,
    backgroundColor,
    foregroundColor
  ]);

  return (
    <div>
      <canvas
        ref={canvas}
        width={width}
        height={height}
        style={{
          '@import': "url('https://fonts.googleapis.com/css?family=Patua+One&display=swap')",
          border: "3px solid black",
          float: "left",
          marginRight: "10px"
        }}
      />
      <form action="">
        <textarea
          value={title}
          onChange={titleChanged}
          style={{
            width: "400px",
            height: "100px"
          }}
        />
        <br />
        <input type="text" onChange={imgSrcChanged} value={imgSrc} />
        <br />
        <input
          type="text"
          onChange={authorImgSrcChanged}
          value={authorImgSrc}
        />
        <br />
        <input type="number" min="100" value={width} onChange={widthChanged} />
        <input type="number" min="100" value={height} onChange={heightChanged} />
        <br />
        <SketchPicker
          color={foregroundColor}
          onChangeComplete={foregroundColorChanged}
        />
        <SketchPicker
          color={backgroundColor}
          onChangeComplete={backgroundColorChanged}
        />
      </form>
    </div>
  );
};

async function getImage(src) {
  if (!src) {
    return null;
  }
  const img = new Image();
  img.src = src;
  try {
    await img.decode();
    return img;
  } catch (error) {
    const customError = new Error(
      `Could not decode img: ${src}: ${error.message}`
    );
    customError.cause = error;
    console.warn(customError);
    return null;
  }
}

function scaleImage(img, maxWidth, maxHeight) {
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  const scaleX = maxWidth / nw;
  const scaleY = maxHeight / nh;
  const scale = Math.min(scaleX, scaleY);
  const w = nw * scale;
  const h = nh * scale;
  return [w, h];
}

function loadAndPaintImage(
  canvas,
  title,
  img,
  authorImg,
  gravity,
  backgroundColor,
  foregroundColor,
  grid
) {
  const [w, h] = scaleImage(img, canvas.width, canvas.height);
  const [x, y] = applyGravity(canvas.width - w, canvas.height - h, gravity);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, x, y, w, h);

  if (authorImg) {
    const scale = 7;
    const [authorW, authorH] = scaleImage(
      authorImg,
      canvas.width / scale,
      canvas.height / scale
    );
    const offset = canvas.width / 40;
    const x = canvas.width - authorW - offset;
    const y = canvas.height - authorH - offset;
    const cx = Math.floor(x + authorW / 2);
    const cy = Math.floor(y + authorH / 2);
    const radius = Math.floor(Math.max(authorW, authorH)) / 2;
    const profileTop = y - 3 * offset;
    const profileHeight = canvas.height - profileTop;

    paintGrid(ctx, canvas.width, canvas.height, profileHeight, grid);

    ctx.save();
    ctx.fillStyle = backgroundColor;
    ctx.filter = "opacity(0.4)";
    ctx.beginPath();
    ctx.arc(cx, cy, 1.2 * radius, 0, 2.0 * Math.PI);
    ctx.fill();
    ctx.fillStyle = foregroundColor;
    ctx.filter = "opacity(1.0)";
    ctx.beginPath();
    ctx.arc(cx, cy, 1.05 * radius, 0, 2.0 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, 0, 2.0 * Math.PI);
    ctx.clip();
    ctx.drawImage(authorImg, x, y, authorW, authorH);
    ctx.restore();
  }

  if (title) {
    const nominalFontSize = 42;
    const lineSpacing = 1.3;
    const padding = canvas.width / 30;
    const lines = title.split(/\n/);
    ctx.save();
    const fontFamily = "'Patua One'";
    ctx.font = `${nominalFontSize}pt ${fontFamily}`;
    const metrics = lines.map(line => ctx.measureText(line));
    const nominalRight = Math.max(
      ...metrics.map(m => m.actualBoundingBoxRight)
    );
    const nominalLeft = Math.min(
      ...metrics.map(m => Math.min(0, m.actualBoundingBoxLeft))
    );
    const nominalLineHeight = Math.max(
      ...metrics.map(m => m.actualBoundingBoxAscent)
    );
    const nominalHeight =
      nominalLineHeight *
      (lines.length + (lines.length - 1) * (lineSpacing - 1));
    const hscale = (canvas.width - padding * 2) / nominalRight;
    const vscale = (canvas.height - padding * 2) / nominalHeight;
    const scale = Math.min(hscale, vscale);
    const fontSize = Math.floor(scale * nominalFontSize);
    ctx.font = `${fontSize}pt ${fontFamily}`;
    const x = padding + nominalLeft * scale;
    const y = padding;
    const lineHeight = nominalLineHeight * scale;
    const step1 = canvas.width / 300;
    const step2 = 2 * step1;
    ctx.save();
    ctx.fillStyle = backgroundColor;
    ctx.filter = `
      drop-shadow(${step1}px ${step1}px 0 ${backgroundColor})
      drop-shadow(${step1}px ${-step1}px 0 ${backgroundColor})
      drop-shadow(${-step1}px ${step1}px 0 ${backgroundColor})
      drop-shadow(${-step1}px ${-step1}px 0 ${backgroundColor})
      drop-shadow(${step2}px ${step2}px 0 ${backgroundColor})
      drop-shadow(${step2}px ${-step2}px 0 ${backgroundColor})
      drop-shadow(${-step2}px ${step2}px 0 ${backgroundColor})
      drop-shadow(${-step2}px ${-step2}px 0 ${backgroundColor})
      blur(${canvas.width / 300}px)
      opacity(40%)
    `;
    lines.forEach((line, idx) => {
      drawText(ctx, lines, x, y, lineHeight, lineSpacing);
    });
    ctx.restore();
    ctx.fillStyle = foregroundColor;
    drawText(ctx, lines, x, y, lineHeight, lineSpacing);
    ctx.restore();
  }
}

function paintGrid(ctx, width, height, fillHeight, grid) {
  const MAX_ALPHA = 0.65;
  const MIN_ALPHA = 0.15;
  const rows = grid.length;
  const length = grid[0].length;
  const cellSize = fillHeight / length;
  function gridLocation(i, j) {
    return [
      width - i * cellSize + cellSize / 2,
      height - fillHeight + j * cellSize + cellSize / 2
    ];
  }
  for (let rowIdx = 0; rowIdx < rows; rowIdx++) {
    for (let cellIdx = 0; cellIdx < length; cellIdx++) {
      const ipct = rowIdx / rows;
      const jpct = 1 - cellIdx / length;
      const PCT_THRESHOLD = 0.15;
      if (jpct * ipct < PCT_THRESHOLD && grid[rowIdx][cellIdx]) {
        ctx.save();
        const alpha =
          (1 - (jpct * ipct) / PCT_THRESHOLD) * (MAX_ALPHA - MIN_ALPHA) +
          MIN_ALPHA;
        ctx.fillStyle = `rgba(100, 150, 180, ${alpha})`;
        ctx.beginPath();
        const [x, y] = gridLocation(rowIdx, cellIdx);
        ctx.moveTo(x, y);
        ctx.arc(x, y, cellSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }
}

function drawText(ctx, lines, sx, y, lineHeight, lineSpacing) {
  lines.forEach((line, idx) => {
    ctx.fillText(
      line,
      sx,
      y + (idx + 1) * lineHeight + idx * lineHeight * (lineSpacing - 1)
    );
  });
}

function applyGravity(sx, sy, gravity = "center") {
  const match = /^(?:(n|north|s|south)?\s*(e|east|w|west)?|(m|middle|c|center))$/.exec(
    gravity.toLowerCase()
  );
  if (!match) {
    console.warn("Invalid gravity specified");
    return [sx / 2, sy / 2];
  }
  const [, vert, horz] = match;
  const y = !vert ? sy / 2 : vert.startsWith("n") ? 0 : sy;
  const x = !horz ? sx / 2 : horz.startsWith("e") ? 0 : sx;
  return [x, y];
}

export default Page;
