import { useRouter } from "next/router";
import React, { useState, useEffect, useRef } from "react";
import getGrid from "../lib/rule110";

async function getScaledImage(src, maxWidth, maxHeight, gravity) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  const scaleX = maxWidth / nw;
  const scaleY = maxHeight / nh;
  const scale = Math.min(scaleX, scaleY);
  const w = nw * scale;
  const h = nh * scale;
  return [img, w, h];
}

async function loadAndPaintImage(
  canvas,
  title,
  imgSrc,
  gravity,
  authorImageSrc,
  backgroundColor,
  foregroundColor,
  grid
) {
  const [img, w, h] = await getScaledImage(imgSrc, canvas.width, canvas.height);
  const [x, y] = applyGravity(canvas.width - w, canvas.height - h, gravity);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, x, y, w, h);

  if (authorImageSrc) {
    const scale = 7;
    const [authorImg, authorW, authorH] = await getScaledImage(
      authorImageSrc,
      canvas.width / scale,
      canvas.height / scale
    );
    const offset = canvas.width / 40;
    const x = canvas.width - authorW - offset;
    const y = canvas.height - authorH - offset;
    const cx = Math.floor(x + authorW / 2);
    const cy = Math.floor(y + authorH / 2);
    const radius = Math.floor(Math.max(authorW, authorH)) / 2;
    const profileTop = y - offset;
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
    const lines = title.split(/\\n/);
    ctx.save();
    ctx.font = `${nominalFontSize}pt serif`;
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
    ctx.font = `${fontSize}pt serif`;
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
  const length = grid[0].length;
  const cellSize = fillHeight / length;
  for (let rowIdx = 0; rowIdx < grid.length; rowIdx++) {
    for (let cellIdx = 0; cellIdx < grid[rowIdx].length; cellIdx++) {
      if (grid[rowIdx][cellIdx]) {
        ctx.save();
        ctx.fillStyle = "blue";
        ctx.beginPath();
        const x = width - rowIdx * cellSize + cellSize / 2;
        const y = height - fillHeight + cellIdx * cellSize + cellSize / 2;
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

const Page = () => {
  const router = useRouter();
  const canvas = useRef();
  const width = parseInt(router.query.dim || 300, 10);
  const foregroundColor = router.query.fgColor || "black";
  const backgroundColor = router.query.bgColor || "rgba(255, 255, 255, 0.7)";

  useEffect(() => {
    const grid = getGrid(20, 50);
    if (!router.query.photo) {
      return;
    }
    if (!canvas.current) {
      return;
    }
    loadAndPaintImage(
      canvas.current,
      router.query.title,
      router.query.photo,
      router.query.gravity,
      router.query.authorImage,
      backgroundColor,
      foregroundColor,
      grid
    );
  }, [
    canvas,
    width,
    router.query.title,
    router.query.photo,
    router.query.gravity,
    router.query.authorImage
  ]);

  return (
    <div>
      <canvas
        ref={canvas}
        width={width}
        height={width}
        style={{ border: "3px solid black" }}
      />
    </div>
  );
};

export default Page;
