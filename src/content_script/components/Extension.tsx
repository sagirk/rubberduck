import * as React from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import * as DataActions from "../actions/dataActions";
import * as StorageActions from "../actions/storageActions";
import Sidebar from "./sidebar";
import * as ChromeUtils from "../utils/chrome";
import * as StorageUtils from "../utils/storage";
import { AuthUtils } from "../utils/authorization";
import { setupObserver as setupSpanObserver } from "../adapters/base/codespan";
import pathAdapterv2 from "../adaptersv2";
import { remoteAPI } from "../utils/api";

let document = window.document;

class Extension extends React.Component<any, any> {
  DataActions: any;
  StorageActions: any;

  constructor(props) {
    super(props);
    this.DataActions = bindActionCreators(DataActions, this.props.dispatch);
    this.StorageActions = bindActionCreators(
      StorageActions,
      this.props.dispatch
    );
  }

  componentDidMount() {
    this.setupChromeListener();
    this.initializeStorage();

    // We can't use our own redux handler for pjax because that
    // is restricted to pjax calls from the sidebar.
    document.addEventListener("pjax:complete", this.onPjaxEnd);
  }

  componentDidUpdate(prevProps, prevState) {
    const { initialized: prevInitialized } = prevProps.storage;
    const { initialized: newInitialized } = this.props.storage;
    const hasLoadedStorage = !prevInitialized && newInitialized;

    if (hasLoadedStorage) {
      // Called when the chrome.storage has been loaded into redux store
      remoteAPI.initialize();
      this.initializeRepoDetails();
      setupSpanObserver();
    }

    if (newInitialized) {
      this.updateSessionAndTree(prevProps, this.props);
    }
  }

  onPjaxEnd = () => {
    this.initializeRepoDetails();
    setupSpanObserver();
  };

  async initializeRepoDetails() {
    const viewInfo = await pathAdapterv2.getViewInfo();

    if (!!viewInfo) {
      this.DataActions.setRepoDetails(viewInfo);
      return viewInfo;
    }
  }

  updateSessionAndTree(prevProps, newProps) {
    // TODO: this is getting called literally on every action
    // like expanding/collapsing the files tree.
    const hasViewChanged = pathAdapterv2.hasViewChanged(
      prevProps.data.view,
      newProps.data.view
    );
    const hasAuthChanged = AuthUtils.hasChanged(
      prevProps.storage,
      newProps.storage
    );

    if (hasAuthChanged || hasViewChanged) {
      this.initializeSession();
      this.initializeFileTree();
    }
  }

  setupChromeListener() {
    ChromeUtils.addChromeListener((messageType, data) => {
      if (messageType === "URL_UPDATED") {
        // This has been replaced by pjax:complete event listener
        // Keeping this event just in case we need it
      } else if (messageType === "STORAGE_UPDATED") {
        this.handleStorageUpdate(data);
      } else if (messageType === "NATIVE_DISCONNECTED") {
        // TODO: if this happens, my view is no longer initialized, and so
        // we need to re-do all that after a new connection has been
        // established
        this.DataActions.updateSessionStatus("disconnected");
      } else if (messageType === "NATIVE_CONNECTED") {
        this.DataActions.updateSessionStatus("connected");
      }
    });
  }

  async initializeStorage() {
    const storageData = await StorageUtils.getAllFromStore();
    this.StorageActions.setFromChromeStorage(storageData);
  }

  // setupAuthorization() {
  //   return Authorization.setup();
  // }

  handleStorageUpdate(data) {
    this.StorageActions.updateFromChromeStorage(data);
  }

  initializeSession() {
    const viewInfo: RemoteView = this.props.data.view;

    if (!!viewInfo.type) {
      this.DataActions.createNewSession(viewInfo);
    }
  }

  initializeFileTree() {
    let repoDetails = this.props.data.repoDetails;

    if (repoDetails.username && repoDetails.reponame) {
      this.DataActions.callTree(repoDetails).then(response => {
        const { payload } = response.action;
        if (payload && payload.nextPage && payload.lastPage) {
          // We were not able to load the entire tree because API is paginated
          let pages: any = [];

          for (let i = payload.nextPage; i <= payload.lastPage; i++) {
            pages.push(i);
          }

          const firstPageRaw = payload.raw;
          this.DataActions.callTreePages(repoDetails, firstPageRaw, pages);
        }
      });
    }
  }

  render() {
    return <Sidebar />;
  }
}

function mapStateToProps(state) {
  const { storage, data } = state;
  return {
    storage,
    data
  };
}
export default connect(mapStateToProps)(Extension);
