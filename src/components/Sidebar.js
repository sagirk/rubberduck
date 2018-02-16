import React from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import "./../index.css";
import * as DataActions from "../actions/dataActions";
import * as StorageActions from "../actions/storageActions";
import Title from "./Title";
import Tree from "./Tree";
import StatusBar from "./StatusBar";
import CollapseButton from "./CollapseButton";
import References from "./References";
import Definitions from "./Definitions";
import HoverListener from "./Hover";
import * as GithubLayout from "./../adapters/github/layout";

class Sidebar extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
    this.DataActions = bindActionCreators(DataActions, this.props.dispatch);
    this.StorageActions = bindActionCreators(
      StorageActions,
      this.props.dispatch
    );
  }

  toggleCollapse() {
    this.DataActions.updateData({
      isSidebarVisible: !this.props.data.isSidebarVisible
    });
  }

  hasRepoDetails() {
    return (
      this.props.data.repoDetails.username &&
      this.props.data.repoDetails.reponame
    );
  }

  renderCollapseButton() {
    return (
      <CollapseButton
        onClick={() => this.toggleCollapse()}
        isVisible={this.props.data.isSidebarVisible}
      />
    );
  }

  renderTitle() {
    return (
      <Title>
        <CollapseButton
          onClick={() => this.toggleCollapse()}
          isVisible={this.props.data.isSidebarVisible}
        />
      </Title>
    );
  }

  renderTree() {
    if (this.hasRepoDetails()) {
      return <Tree isVisible={this.props.data.openSection === "tree"} />;
    }
  }

  renderReferences() {
    return (
      <References
        isVisible={this.props.data.openSection === "references"}
        selectionX={this.props.data.textSelection.x}
        selectionY={this.props.data.textSelection.y}
      />
    );
  }

  renderDefinitions() {
    return (
      <Definitions
        isVisible={this.props.data.openSection === "definitions"}
        selectionX={this.props.data.textSelection.x}
        selectionY={this.props.data.textSelection.y}
      />
    );
  }

  render() {
    GithubLayout.updateLayout(this.props.data.isSidebarVisible, 232); // 232 = sidebar width in pixels

    if (this.props.data.isSidebarVisible) {
      return (
        <div className="mercury-container">
          {this.renderTitle()}
          {this.renderTree()}
          {this.renderReferences()}
          {this.renderDefinitions()}
          <HoverListener />
          <StatusBar />
        </div>
      );
    } else {
      return (
        <CollapseButton
          onClick={() => this.toggleCollapse()}
          isVisible={false}
        />
      );
    }
  }
}

function mapStateToProps(state) {
  const { storage, data } = state;
  return {
    storage,
    data
  };
}
export default connect(mapStateToProps)(Sidebar);