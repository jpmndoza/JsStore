var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
import { IdbHelper } from "../idb_helper";
import { Helper } from "./helper";
import { LogHelper } from "../../log_helper";
import { Util } from "../../util";
import { Error_Type } from "../../enums";
var Instance = /** @class */ (function (_super) {
    __extends(Instance, _super);
    function Instance(query, onSuccess, onError) {
        var _this = _super.call(this) || this;
        _this._onError = onError;
        _this._onSuccess = onSuccess;
        _this._query = query;
        _this._skipRecord = query.skip;
        _this._limitRecord = query.limit;
        _this._tableName = query.from;
        return _this;
    }
    Instance.prototype.execute = function () {
        if (this.isTableExist(this._tableName) === true) {
            try {
                if (this._query.where !== undefined) {
                    this.addGreatAndLessToNotOp();
                    this.initTransaction();
                    if (Array.isArray(this._query.where)) {
                        this.processWhereArrayQry();
                    }
                    else {
                        this.processWhere();
                    }
                }
                else {
                    this.initTransaction();
                    this.executeWhereUndefinedLogic();
                }
            }
            catch (ex) {
                this._errorOccured = true;
                this.onExceptionOccured.call(this, ex, { TableName: this._query.From });
            }
        }
        else {
            this._errorOccured = true;
            this.onErrorOccured(new LogHelper(Error_Type.TableNotExist, { TableName: this._query.From }).get(), true);
        }
    };
    Instance.prototype.processWhereArrayQry = function () {
        this._isArrayQry = true;
        var is_first_where = true, where_query = this._query.where, output = [], operation, pKey = this.getPrimaryKey(this._query.From), isItemExist = function (keyValue) {
            var is_exist = false;
            output.every(function (item) {
                if (item[pKey] === keyValue) {
                    is_exist = true;
                    return false;
                }
                return true;
            });
            return is_exist;
        }, onSuccess = function () {
            if (operation === 'and') {
                var doAnd = function () {
                    var and_results = [];
                    this._results.forEach(function (item) {
                        if (isItemExist(item[pKey])) {
                            and_results.push(item);
                        }
                    });
                    output = and_results;
                    and_results = null;
                }.bind(this);
                if (output.length > 0) {
                    doAnd();
                }
                else if (is_first_where === true) {
                    output = this._results;
                }
                else {
                    doAnd();
                }
            }
            else {
                if (output.length > 0) {
                    this._results = output.concat(this._results);
                    this.removeDuplicates();
                    output = this._results;
                }
                else {
                    output = this._results;
                }
            }
            if (where_query.length > 0) {
                this._results = [];
                processFirstQry();
            }
            else {
                this._results = output;
            }
            is_first_where = false;
        }.bind(this), processFirstQry = function () {
            this._query.where = where_query.shift();
            if (this._query.where['or']) {
                if (Object.keys(this._query.where).length === 1) {
                    operation = 'or';
                    this._query.where = this._query.where['or'];
                    this._onWhereArrayQrySuccess = onSuccess;
                }
                else {
                    operation = 'and';
                    this._onWhereArrayQrySuccess = onSuccess;
                }
            }
            else {
                operation = 'and';
                this._onWhereArrayQrySuccess = onSuccess;
            }
            this.processWhere();
        }.bind(this);
        processFirstQry();
    };
    Instance.prototype.onQueryFinished = function () {
        if (this._isOr === true) {
            this.orQuerySuccess();
        }
        else if (this._isArrayQry === true) {
            this._onWhereArrayQrySuccess();
        }
        else if (this._isTransaction === true) {
            this.onTransactionCompleted();
        }
    };
    Instance.prototype.initTransaction = function () {
        IdbHelper.createTransaction([this._tableName], this.onTransactionCompleted.bind(this), 'readonly');
        this._objectStore = IdbHelper._transaction.objectStore(this._tableName);
    };
    Instance.prototype.processWhere = function () {
        if (this._query.where.or) {
            this.processOrLogic();
        }
        this.goToWhereLogic();
    };
    Instance.prototype.onTransactionCompleted = function () {
        if (this._errorOccured === false) {
            this.processOrderBy();
            if (this._query.Distinct) {
                var group_by = [];
                var result = this._results[0];
                for (var key in result) {
                    group_by.push(key);
                }
                var primary_key = this.getPrimaryKey(this._query.From), index = group_by.indexOf(primary_key);
                group_by.splice(index, 1);
                this._query.GroupBy = group_by.length > 0 ? group_by : null;
            }
            if (this._query.GroupBy) {
                if (this._query.Aggregate) {
                    this.executeAggregateGroupBy();
                }
                else {
                    this.processGroupBy();
                }
            }
            else if (this._query.Aggregate) {
                this.processAggregateQry();
            }
            this._onSuccess(this._results);
        }
    };
    Instance.prototype.orQueryFinish = function () {
        this._isOr = false;
        this._results = this._orInfo.Results;
        // free or info memory
        this._orInfo = undefined;
        this.removeDuplicates();
        this.onQueryFinished();
    };
    Instance.prototype.orQuerySuccess = function () {
        this._orInfo.Results = this._orInfo.Results.concat(this._results);
        if (!this._query.Limit || (this._query.Limit > this._orInfo.Results.length)) {
            this._results = [];
            var key = Util.getObjectFirstKey(this._orInfo.OrQuery);
            if (key != null) {
                var where = {};
                where[key] = this._orInfo.OrQuery[key];
                delete this._orInfo.OrQuery[key];
                this._query.where = where;
                this.goToWhereLogic();
            }
            else {
                this.orQueryFinish();
            }
        }
        else {
            this.orQueryFinish();
        }
    };
    Instance.prototype.processOrLogic = function () {
        this._isOr = true;
        this._orInfo = {
            OrQuery: this._query.where.or,
            Results: []
        };
        // free or memory
        delete this._query.where.or;
    };
    return Instance;
}(Helper));
export { Instance };
//# sourceMappingURL=instance.js.map