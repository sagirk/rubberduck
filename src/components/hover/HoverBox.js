import React from "react";
import PropTypes from "prop-types";
import Docstring from "../common/Docstring";
import HoverSignature from "./HoverSignature";
import "./Hover.css";

const MAX_HEIGHT = 240;
const MAX_WIDTH = 300;
const TOP_MARGIN = 4;

const ExpandHelper = props => (
  <div className="expand-helper">
    {props.isExpandable ? (
      <div style={{ textAlign: "left" }}>
        {"⌘ "}
        <strong>{"expand"}</strong>
      </div>
    ) : null}
    <div style={{ textAlign: "right" }}>
      {"⌘ + click "}
      <strong>{`${props.action}`}</strong>
    </div>
  </div>
);

export default class HoverBox extends React.Component {
  // Presentation component for the hover box
  static propTypes = {
    name: PropTypes.string,
    docstring: PropTypes.string,
    lineNumber: PropTypes.number,
    charNumber: PropTypes.number,
    filePath: PropTypes.string,
    fileSha: PropTypes.string,
    x: PropTypes.number,
    y: PropTypes.number,
    element: PropTypes.object,
    isDefinition: PropTypes.bool,
    isExpanded: PropTypes.bool
  };

  isVisibleToUser = () => this.props.x > 0;

  getPosition = () => {
    // This decides where the hover box should be placed, looking at the
    // bounding rectangle of the element and the window.
    let left = this.props.x;
    let top = this.props.y;
    const { element } = this.props;

    if (element && element.getBoundingClientRect) {
      const boundRect = element.getBoundingClientRect();
      left = boundRect.left || left;
      top = boundRect.top || top;

      if (left + MAX_WIDTH > window.innerWidth) {
        left = window.innerWidth - MAX_WIDTH - 20;
      }

      if (top < MAX_HEIGHT) {
        // The box should be at the bottom of the element
        top = boundRect.bottom + TOP_MARGIN;
        return { left, top };
      }
    }

    return {
      left,
      bottom: window.innerHeight - top + TOP_MARGIN
    };
  };

  getDisplay = () => {
    // Adding display styling for the opacity animation to trigger
    if (this.isVisibleToUser()) {
      return { display: "block" };
    } else {
      return { display: "none" };
    }
  };

  getStyle = () => {
    return { ...this.getPosition(), ...this.getDisplay() };
  };

  renderSignature() {
    const { name, signature, language } = this.props;
    return (
      <div className="signature monospace">
        <HoverSignature
          language={language || ""}
          signature={signature || name || ""}
        />
      </div>
    );
  }

  renderDocstring = className => {
    const { docstring } = this.props;
    return docstring ? (
      <div className={`docstring ${className}`}>
        <Docstring docstring={this.props.docstring} />
      </div>
    ) : null;
  };

  renderBasic = () => this.renderDocstring("basic");

  renderExpanded = () => this.renderDocstring("expanded");

  render() {
    const action = this.props.isDefinition ? "usages" : "definition";
    const isExpandable = this.props.docstring ? true : false;

    return (
      <div className="hover-box" style={this.getStyle()}>
        <ExpandHelper isExpandable={isExpandable} action={action} />
        {this.props.isExpanded ? this.renderExpanded() : this.renderBasic()}
        {this.renderSignature()}
      </div>
    );
  }
}
