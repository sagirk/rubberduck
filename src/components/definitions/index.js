import React from "react";
import { connect } from "react-redux";
import { BaseReaderSection } from "../section";
import { WS } from "./../../utils/websocket";
import DefinitionItem from "./DefinitionItem";
import "./Definitions.css";

class Definitions extends BaseReaderSection {
  // This gets x and y of the selected text, constructs the
  // API call payload by reading DOM, and then display the
  // result of the API call.
  state = {
    isVisible: false,
    isLoading: false,
    definition: {}
  };

  clearState = () => {
    this.setState({
      definition: {}
    });
  };

  getSelectionData = () => {
    const hoverResult = this.readPage();
    const isValidResult =
      hoverResult.hasOwnProperty("fileSha") &&
      hoverResult.hasOwnProperty("lineNumber");

    if (isValidResult && this.state.isVisible) {
      this.startLoading();
      const { fileSha, filePath, lineNumber, charNumber } = hoverResult;
      WS.getDefinition(fileSha, filePath, lineNumber, charNumber)
        .then(response => {
          this.stopLoading();
          const result = response.result;
          let filePath = result.definition.location
            ? result.definition.location.path
            : "";

          const definition = {
            name: result.name,
            filePath: filePath,
            startLineNumber: result.definition.contents_start_line,
            lineNumber: result.definition.location.range.start.line,
            docstring: result.docstring,
            codeSnippet: result.definition.contents
          };
          this.setState({ definition: definition });
        })
        .catch(error => {
          this.stopLoading();
          console.log("Error in API call", error);
        });
    }
  };

  getFileLink = () => {
    const { username, reponame, branch } = this.props.data.repoDetails;
    const { filePath, lineNumber } = this.state.definition;
    const offsetLine = lineNumber + 1;
    return `/${username}/${reponame}/blob/${branch}/${filePath}#L${offsetLine}`;
  };

  renderItems = () =>
    this.state.isLoading ? (
      <div className="loader-container" style={{ marginTop: 20 }}>
        <div className="status-loader" />
      </div>
    ) : this.props.selectionX ? (
      <DefinitionItem
        {...this.state.definition}
        fileLink={this.getFileLink()}
        visible={this.state.isVisible}
      />
    ) : (
      this.renderZeroState()
    );

  render() {
    let definitonClassName = this.state.isVisible
      ? "definitions-section"
      : "definitions-section collapsed";
    return (
      <div className={definitonClassName}>
        {this.renderSectionHeader("Definitions")}
        {this.renderItems()}
      </div>
    );
  }
}

function mapStateToProps(state) {
  const { storage, data } = state;
  return {
    storage,
    data
  };
}
export default connect(mapStateToProps)(Definitions);
