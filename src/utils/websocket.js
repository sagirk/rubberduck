import Store from "../store";
import { bindActionCreators } from "redux";
import io from "socket.io-client";
import parser from "socket.io-json-parser";

import WebSocketAsPromised from "websocket-as-promised";
import Raven from "raven-js";
import * as DataActions from "../actions/dataActions";
import { rootUrl } from "./api";
import { getGitService } from "../adapters";

function exponentialBackoff(attempt, delay) {
  return Math.floor(Math.random() * Math.pow(2, attempt) * delay);
}

class BaseWebSocketIO {
  constructor() {
    this.socket = null;
  }

  createWebsocket = (token, onClose) => {
    if (this.socket === null) {
      const baseWsUrl = rootUrl.replace("http", "ws");
      const wsUrl = `${baseWsUrl}sessions/?token=${token}`;
      this.socket = io(wsUrl, {
        query: { token },
        parser
      });
    }
  };

  tearDown = () => {};
}

/**
 * Base class that has methods for a socket connection
 */
class BaseWebSocket {
  constructor() {
    this.wsp = null;
  }

  isConnected = () => {
    return this.wsp && this.wsp.isOpened;
  };

  isConnecting = () => {
    return this.wsp && this.wsp.isOpening;
  };

  createWebsocket = (token, onClose) => {
    if (this.wsp === null) {
      const baseWsUrl = rootUrl.replace("http", "ws");
      const wsUrl = `${baseWsUrl}sessions/?token=${token}`;
      this.wsp = new WebSocketAsPromised(wsUrl, {
        packMessage: data => JSON.stringify(data),
        unpackMessage: message => JSON.parse(message),
        attachRequestId: (data, requestId) =>
          Object.assign({ id: requestId }, data),
        extractRequestId: data => data && data.id
      });
      this.wsp.onClose.addListener(response => onClose(response));
    }
  };

  connectSocket = (token, onClose) => {
    this.createWebsocket(token, onClose);
    return this.wsp.open();
  };

  tearDown = () => {
    if (this.wsp !== null) {
      return this.wsp.close().then(() => (this.wsp = null));
    } else {
      // Socket was never actually created
      return new Promise((resolve, reject) => {
        resolve();
      });
    }
  };

  sendRequest = payload => {
    return new Promise((resolve, reject) => {
      this.wsp.sendRequest(payload).then(response => {
        // response can have result or error
        // call promise method accordingly
        if (response.error !== undefined) {
          reject(response);
        } else {
          resolve(response);
        }
      });
    });
  };

  setupListener = listener => {
    this.wsp.onPackedMessage.addListener(message => {
      // Console log if this will not be handled by a promise later
      if (message.id === undefined) {
        listener(message);
      }
    });
  };

  createPRSession = (organisation, name, pull_request_id) => {
    return this.sendRequest({
      type: "session.create",
      payload: {
        organisation,
        name,
        service: getGitService(),
        pull_request_id
      }
    });
  };

  createCompareSession = (organisation, name, head_sha, base_sha) => {
    return this.sendRequest({
      type: "session.create",
      payload: {
        organisation,
        name,
        service: getGitService(),
        head_sha,
        base_sha
      }
    });
  };

  getHover = (baseOrHead, filePath, lineNumber, charNumber) => {
    const queryParams = {
      is_base_repo: baseOrHead === "base" ? "true" : "false",
      location_id: `${filePath}#L${lineNumber}#C${charNumber}`
    };
    return this.sendRequest({
      type: "session.hover",
      payload: queryParams
    });
  };

  getReferences = (baseOrHead, filePath, lineNumber, charNumber) => {
    const queryParams = {
      is_base_repo: baseOrHead === "base" ? "true" : "false",
      location_id: `${filePath}#L${lineNumber}#C${charNumber}`
    };
    return this.sendRequest({
      type: "session.references",
      payload: queryParams
    });
  };

  getDefinition = (baseOrHead, filePath, lineNumber, charNumber) => {
    const queryParams = {
      is_base_repo: baseOrHead === "base" ? "true" : "false",
      location_id: `${filePath}#L${lineNumber}#C${charNumber}`
    };
    return this.sendRequest({
      type: "session.definition",
      payload: queryParams
    });
  };

  getFileContents = (baseOrHead, filePath) => {
    const queryParams = {
      is_base_repo: baseOrHead === "base" ? "true" : "false",
      location_id: `${filePath}`
    };
    return this.sendRequest({
      type: "session.file_contents",
      payload: queryParams
    }).then(response => ({ ...response, filePath, baseOrHead }));
  };
}

/**
 * The manager maintains the socket connection for a session
 * Ensures connectivity, handles session status updates
 */
class WebSocketManager {
  constructor() {
    this.isReady = false;
    this.reconnectAttempts = 0;
    this.sessionParams = {};
    this.ws = new BaseWebSocket();
    this.DataActions = bindActionCreators(DataActions, Store.dispatch);
  }

  dispatchStatus = status => {
    this.DataActions.updateSessionStatus({ status });
  };

  statusUpdatesListener = message => {
    // This will trigger the UI states for session status
    this.dispatchStatus(message.status_update);

    if (message.status_update === "ready") {
      this.isReady = true;
    } else if (message.status_update === "error") {
      console.log("Error in creating session", message);
    }
  };

  setupListener = () => {
    this.ws.setupListener(message => {
      if (message.status_update !== undefined) {
        this.statusUpdatesListener(message);
      }
    });
  };

  reconnectIfRequired = () => {
    // We should reconnect if the socket connection was `ready`
    // and the server disconnected.
    if (!this.ws.isConnected()) {
      this.reconnectAttempts += 1;
      this.createSession().then(response => {
        this.reconnectAttempts = 0;
      });
    }
  };

  tryReconnection = () => {
    setTimeout(
      this.reconnectIfRequired,
      exponentialBackoff(this.reconnectAttempts, 1000)
    );
  };

  onSocketClose = closeResponse => {
    this.dispatchStatus("disconnected");
    this.isReady = false;

    if (!closeResponse.wasClean) {
      // This means we did not explicitly close the connection ourself
      this.tryReconnection();
    }
  };

  createConnection = () => {
    const token = Store.getState().storage.token;
    return new Promise((resolve, reject) => {
      this.dispatchStatus("connecting");
      this.ws
        .connectSocket(token, this.onSocketClose)
        .then(() => {
          this.isReady = false;
          this.setupListener();
          resolve();
        })
        .catch(err => {
          this.tryReconnection();
          reject(err);
        });
    });
  };

  tearDownIfRequired = () => {
    if (this.ws.isConnected() || this.ws.isConnecting()) {
      this.isReady = false;
      return this.ws.tearDown();
    } else {
      return new Promise((resolve, reject) => {
        resolve();
      });
    }
  };

  isNoAccessError = error =>
    error.indexOf("Repository not found") >= 0 ||
    error.indexOf("Branch not found") >= 0 ||
    error.indexOf("Pull Request not found") >= 0;

  createNewSession = params => {
    this.sessionParams = params;
    this.reconnectAttempts = 0;
    return this.createSession().catch(error => {
      if (error.error && error.error.indexOf("Language not supported") >= 0) {
        this.dispatchStatus("unsupported_language");
      } else if (error === "No session to be created") {
        this.dispatchStatus("no_session");
      } else if (error.error && this.isNoAccessError(error.error)) {
        this.dispatchStatus("no_access");
      } else {
        // Unknown error, sent to Sentry
        this.dispatchStatus("error");
        Raven.captureException(error);
      }
    });
  };

  createSession = () => {
    // This method is called with params, and internally
    // we need to figure out which type of session this is
    const params = this.sessionParams;
    return this.tearDownIfRequired()
      .then(this.createConnection)
      .then(() => {
        if (params.type === "pull") {
          this.dispatchStatus("creating");
          return this.ws.createPRSession(
            params.organisation,
            params.name,
            params.pull_request_id
          );
        } else if (params.type === "file") {
          this.dispatchStatus("creating");
          return this.ws.createCompareSession(
            params.organisation,
            params.name,
            params.head_sha
          );
        } else if (params.type === "commit" || params.type === "compare") {
          this.dispatchStatus("creating");
          return this.ws.createCompareSession(
            params.organisation,
            params.name,
            params.head_sha,
            params.base_sha
          );
        } else {
          return Promise.reject("No session to be created");
        }
      })
      .then(response => {
        return response.result;
      });
  };

  getLSCallHelper = (method, ...params) => {
    // We can only make these calls once ready
    if (this.isReady) {
      return method(...params);
    } else {
      return new Promise((resolve, reject) => {
        reject();
      });
    }
  };

  getHover = (...params) => {
    return this.getLSCallHelper(this.ws.getHover, ...params);
  };

  getReferences = (...params) => {
    return this.getLSCallHelper(this.ws.getReferences, ...params);
  };

  getDefinition = (...params) => {
    return this.getLSCallHelper(this.ws.getDefinition, ...params);
  };

  getFileContents = (...params) => {
    return this.getLSCallHelper(this.ws.getFileContents, ...params);
  };
}

export const WS = new WebSocketManager();
