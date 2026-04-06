/**
 * Simplified Arrow component without styled-components dependency
 * Creates smooth curved arrows using SVG and inline styles
 */
import React from "react";

import {
  calculateDeltas,
  calculateCanvasDimensions,
  calculateControlPoints
} from "./arrow-utils";
import { Point } from "./types";

const CONTROL_POINTS_RADIUS = 5;
const STRAIGHT_LINE_BEFORE_ARROW_HEAD = 5;

type ArrowConfig = {
  arrowColor?: string;
  arrowHighlightedColor?: string;
  controlPointsColor?: string;
  boundingBoxColor?: string;
  dotEndingBackground?: string;
  dotEndingRadius?: number;
  arrowHeadEndingSize?: number;
  hoverableLineWidth?: number;
  strokeWidth?: number;
};

type Props = {
  startPoint: Point;
  endPoint: Point;
  isHighlighted?: boolean;
  showDebugGuideLines?: boolean;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  config?: ArrowConfig;
  tooltip?: string;
  disablePointerEvents?: boolean;
};

export const Arrow = ({
  startPoint,
  endPoint,
  isHighlighted = false,
  showDebugGuideLines = false,
  onMouseEnter,
  onMouseLeave,
  onClick,
  config,
  tooltip,
  disablePointerEvents
}: Props) => {
  const defaultConfig = {
    arrowColor: "#bcc4cc",
    arrowHighlightedColor: "#4da6ff",
    controlPointsColor: "#ff4747",
    boundingBoxColor: "#ffcccc",
    dotEndingBackground: "#fff",
    dotEndingRadius: 3,
    arrowHeadEndingSize: 9,
    hoverableLineWidth: 15,
    strokeWidth: 1
  };
  const currentConfig = {
    ...defaultConfig,
    ...config
  };

  const {
    arrowColor,
    arrowHighlightedColor,
    controlPointsColor,
    boundingBoxColor,
    arrowHeadEndingSize,
    strokeWidth,
    hoverableLineWidth,
    dotEndingBackground,
    dotEndingRadius
  } = currentConfig;

  const arrowHeadOffset = arrowHeadEndingSize / 2;
  const boundingBoxElementsBuffer =
    strokeWidth +
    arrowHeadEndingSize / 2 +
    dotEndingRadius +
    CONTROL_POINTS_RADIUS / 2;

  const { absDx, absDy, dx, dy } = calculateDeltas(startPoint, endPoint);
  const { p1, p2, p3, p4, boundingBoxBuffer } = calculateControlPoints({
    boundingBoxElementsBuffer,
    dx,
    dy,
    absDx,
    absDy
  });

  const { canvasWidth, canvasHeight } = calculateCanvasDimensions({
    absDx,
    absDy,
    boundingBoxBuffer
  });

  const canvasXOffset =
    Math.min(startPoint.x, endPoint.x) - boundingBoxBuffer.horizontal;
  const canvasYOffset =
    Math.min(startPoint.y, endPoint.y) - boundingBoxBuffer.vertical;

  const curvedLinePath = `
    M ${p1.x} ${p1.y}
    C ${p2.x} ${p2.y},
    ${p3.x} ${p3.y},
    ${p4.x - STRAIGHT_LINE_BEFORE_ARROW_HEAD} ${p4.y}
    L ${p4.x} ${p4.y}`;

  const strokeColor = isHighlighted ? arrowHighlightedColor : arrowColor;

  const svgStyle: React.CSSProperties = {
    pointerEvents: 'none',
    zIndex: isHighlighted ? 2 : 1,
    position: 'absolute',
    left: 0,
    top: 0,
    transform: `translate(${canvasXOffset}px, ${canvasYOffset}px)`,
    border: showDebugGuideLines ? `dashed 1px ${boundingBoxColor}` : '0'
  };

  const endingsSvgStyle: React.CSSProperties = {
    pointerEvents: 'none',
    zIndex: isHighlighted ? 11 : 10,
    position: 'absolute',
    left: 0,
    top: 0,
    transform: `translate(${canvasXOffset}px, ${canvasYOffset}px)`
  };

  const arrowHeadPath = `
    M ${(arrowHeadEndingSize / 5) * 2} 0
    L ${arrowHeadEndingSize} ${arrowHeadEndingSize / 2}
    L ${(arrowHeadEndingSize / 5) * 2} ${arrowHeadEndingSize}`;

  return (
    <>
      <svg
        width={canvasWidth}
        height={canvasHeight}
        style={svgStyle}
      >
        {/* Visible curved line */}
        <path
          d={curvedLinePath}
          strokeWidth={strokeWidth}
          stroke={strokeColor}
          fill="none"
          style={{ transition: 'stroke 300ms' }}
        />

        {/* Invisible wider hoverable line */}
        <path
          d={curvedLinePath}
          strokeWidth={hoverableLineWidth}
          stroke="transparent"
          pointerEvents={disablePointerEvents ? "none" : "all"}
          fill="none"
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onClick={onClick}
          style={{ cursor: 'default' }}
        >
          {tooltip && <title>{tooltip}</title>}
        </path>

        {/* Hoverable arrowhead */}
        <g transform={`translate(${p4.x - arrowHeadOffset * 2}, ${p4.y - arrowHeadOffset})`}>
          <path
            d={arrowHeadPath}
            fill="none"
            stroke="transparent"
            strokeWidth={hoverableLineWidth}
            strokeLinecap="round"
            pointerEvents={disablePointerEvents ? "none" : "all"}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={onClick}
            style={{ cursor: 'default' }}
          >
            {tooltip && <title>{tooltip}</title>}
          </path>
        </g>

        {/* Hoverable dot at start */}
        <circle
          cx={p1.x}
          cy={p1.y}
          r={dotEndingRadius}
          stroke="transparent"
          strokeWidth={hoverableLineWidth}
          fill="transparent"
        >
          {tooltip && <title>{tooltip}</title>}
        </circle>
      </svg>

      {/* Endings layer (dot and arrowhead) */}
      <svg
        width={canvasWidth}
        height={canvasHeight}
        style={endingsSvgStyle}
      >
        {/* Visible dot at start */}
        <circle
          cx={p1.x}
          cy={p1.y}
          r={dotEndingRadius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill={dotEndingBackground}
          style={{ transition: 'stroke 300ms' }}
        />

        {/* Visible arrowhead */}
        <g transform={`translate(${p4.x - arrowHeadOffset * 2}, ${p4.y - arrowHeadOffset})`}>
          <path
            d={arrowHeadPath}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{ transition: 'stroke 300ms' }}
          />
        </g>

        {/* Debug control points */}
        {showDebugGuideLines && (
          <>
            <circle cx={p2.x} cy={p2.y} r={CONTROL_POINTS_RADIUS} strokeWidth="0" fill={controlPointsColor} />
            <circle cx={p3.x} cy={p3.y} r={CONTROL_POINTS_RADIUS} strokeWidth="0" fill={controlPointsColor} />
            <line strokeDasharray="1,3" stroke={controlPointsColor} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />
            <line strokeDasharray="1,3" stroke={controlPointsColor} x1={p3.x} y1={p3.y} x2={p4.x} y2={p4.y} />
          </>
        )}
      </svg>
    </>
  );
};
