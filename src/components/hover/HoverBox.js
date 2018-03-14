import React from "react";
import PropTypes from "prop-types";
import Docstring from "../common/Docstring";
import CodeNode from "../common/CodeNode";
import "./Hover.css";

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
    boundRect: PropTypes.object,
    onReferences: PropTypes.func,
    onDefinition: PropTypes.func
  };

  renderButtons = () => {
    return (
      <div className="button-container">
        <a
          className="button-div hover-button"
          onClick={this.props.onReferences}
        >
          Find usages
        </a>
        <a
          className="button-div hover-button"
          onClick={this.props.onDefinition}
        >
          Open definition
        </a>
      </div>
    );
  };

  getPosition = () => {
    let left = this.props.x;
    let top = this.props.y;

    if (this.props.boundRect) {
      left = this.props.boundRect.left || left;
      top = this.props.boundRect.top || top;
    }

    return {
      left,
      bottom: window.innerHeight - top - 10
    };
  };

  render() {
    return (
      <div className="hover-box" style={this.getPosition()}>
        <div className="title">
          <CodeNode
            name={this.props.name}
            file={this.props.filePath}
            showButton={false}
          />
        </div>
        <div className="docstring">{Docstring(this.props.docstring)}</div>
        {this.renderButtons()}
      </div>
    );
  }
}
