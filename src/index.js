import { futurizeP } from 'futurize'
import Task, { rejected } from 'data.task'
import { fromNullable, Just, Nothing } from 'data.maybe'
import 'whatwg-fetch'

const isNil = val => val == null

const future = futurizeP(Task)
const futurizedFetch = future(fetch)

const url = ({ baseUrl }, target) => `${baseUrl}/${target}`

// const isServerError = err => err.restfulStatus === 'ERROR'

const httpErrorTask = resp => {
  /*eslint-disable*/
  console.log('raw Error', resp, 'content-type is ', resp.headers.get('Content-Type'))
  /*eslint-enable*/
  if (
    isNil(resp.headers.get('Content-Type')) ||
    resp.headers.get('Content-Type').includes('text')
  ) {
    //TODO: add error code
    const { status, statusText } = resp
    return new Task((reject, resolve) =>
      resp
        .text()
        .then(err =>
          reject({
            restfulStatus: status,
            errorMsg: statusText,
            stackTrace: `${statusText}\n${err}`,
            targetUrl: resp.url,
            httpError: true,
          })
        )
        .catch(reject)
    )
  }
  if (resp.headers.get('Content-Type').includes('json')) {
    return new Task((reject, resolve) =>
      resp
        .json()
        .then(e => reject({ ...e, targetUrl: resp.url }))
        .catch(reject)
    )
  }
  return rejected(resp)
}

const errorStatusList = ['FAILURE', 'INVALID', 'ERROR']

const processHttpResp = resp =>
  resp
    .chain(res => (res.status === 200 ? Task.of(res) : httpErrorTask(res)))
    .chain(
      res =>
        isNil(res.headers.get('Content-Type')) || res.headers.get('Content-Type').includes('text')
          ? new Task((reject, success) =>
              res
                .text()
                .then(success)
                .catch(reject)
            )
          : new Task((reject, success) =>
              res
                .json()
                .then(success)
                .catch(reject)
            )
    )
    .chain(resp => (errorStatusList.includes(resp.restfulStatus) ? rejected(resp) : Task.of(resp)))

const compose = (f, g) => (...args) => f(g(...args))

const fetchAndHandleError = compose(processHttpResp, futurizedFetch)

const authHeader = ({ jwt }, { ignoreAuth } = {}) =>
  jwt && !ignoreAuth ? { Authorization: `JWT ${jwt}` } : {}

export const post = (targetInfo, target, options) => payload =>
  fetchAndHandleError(url(targetInfo, target), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeader(targetInfo, options),
    },
    body: fromNullable(payload)
      .map(JSON.stringify)
      .getOrElse(undefined),
  })

export const deleteTask = (targetInfo, target) => payload =>
  fetchAndHandleError(url(targetInfo, target), {
    method: 'DELETE',
    headers: {
      'Content-Type': 'bapplication/json',
      ...authHeader(targetInfo),
    },
    body: fromNullable(payload)
      .map(JSON.stringify)
      .getOrElse(undefined),
  })

/** need to put security info here **/
export const get = (targetInfo, target) =>
  fetchAndHandleError(url(targetInfo, target), {
    headers: authHeader(targetInfo),
  })
