module JsStore {
    export module Business {
        export class SelectHelperLogic extends BaseSelectLogic {
            Query: ISelect;

            protected executeMultipleWhereInLogic = function (whereInArray: Array<IWhereIn>) {
                var That = this,
                    WhereIn,
                    ExecutionNo = 0,
                    ConditionLength = Object.keys(this.Query.WhereIn).length,
                    KeyRange: IDBKeyRange,
                    OnSuccessGetRequest = function () {
                        ++ExecutionNo;
                        if (ExecutionNo == ConditionLength) {
                            this.OnSuceessRequest();
                        }
                    };

                for (WhereIn in whereInArray) {
                    KeyRange = this.getKeyRange();
                    if (!this.ErrorOccured) {
                        var CursorOpenRequest,
                            OnCursorSuccess = function (e) {
                                var Cursor: IDBCursorWithValue = (<any>e).target.result;
                                if (Cursor) {
                                    That.Results.push(Cursor.value);
                                    Cursor.continue();
                                }
                                else {
                                    OnSuccessGetRequest();
                                }
                            },
                            OnCursorError = function (e) {
                                That.ErrorOccured = true;
                                That.OnErrorRequest(e);
                            };
                        if (this.ObjectStore.indexNames.contains(WhereIn.Column)) {
                            CursorOpenRequest = this.ObjectStore.index(WhereIn.Column).openCursor(KeyRange);
                            CursorOpenRequest.onsuccess = OnCursorSuccess;
                            CursorOpenRequest.onerror = OnCursorError;
                        }
                        else {
                            UtilityLogic.getError(ErrorType.ColumnNotExist, true, { ColumnName: Column });
                        }
                    }
                    else {
                        return;
                    }
                }
            }

            protected executeSingleWhereInLogic = function (whereIn: IWhereIn) {
                var That: BaseSelectLogic = this,
                    KeyRange: IDBKeyRange = this.getKeyRange(whereIn);

                if (!this.ErrorOccured) {
                    var CursorOpenRequest,
                        OnCursorSuccess = function (e) {
                            var Cursor: IDBCursorWithValue = (<any>e).target.result;
                            if (Cursor) {
                                That.Results.push(Cursor.value);
                                Cursor.continue();
                            }

                        },
                        OnCursorError = function (e) {
                            this.ErrorOccured = true;
                            this.OnErrorRequest(e);
                        };
                    if (this.ObjectStore.indexNames.contains(whereIn.Column)) {
                        CursorOpenRequest = this.ObjectStore.index(whereIn.Column).openCursor(KeyRange);
                        CursorOpenRequest.onsuccess = OnCursorSuccess;
                        CursorOpenRequest.onerror = OnCursorError;
                    }
                    else {
                        UtilityLogic.getError(ErrorType.ColumnNotExist, true, { ColumnName: whereIn.Column });
                    }
                }
            }


        }
    }
}
