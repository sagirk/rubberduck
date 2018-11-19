import { createReducer } from "redux-create-reducer";

export default createReducer(
  {},
  {
    SET_HOVER_RESULT: (state, action) => ({
      ...state,
      ...action.payload
    })
  }
);