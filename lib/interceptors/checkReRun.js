const Interceptor = require('./interceptor')

const DATA_START = '<!-- #mergeable-data'
const DATA_END = '#mergeable-data -->'

/**
 * Checks the event for a re-requested check_run. This GH event is triggered when the user
 * clicks on "Re-run" or "Re-run failed checks" in the UI and expects conditions to be re-validated. Fetch the PR and it's stored condition from
 * the check run text.
 *
 * Set the context up with the appropriate PR payload, event and action for a validation and check run.
 *
 * NOTE: "Re-run all checks" generates a different event and is not taken care of in this interceptor.
 */
class CheckReRun extends Interceptor {
  async process (context) {
    if (context.event !== 'check_run' && context.payload.action !== 'rerequested') return context

    let checkRun = context.payload.check_run
    if (!checkRun) return context

    let meta = this.parseEventAction(checkRun.output.text)
    if (this.possibleInjection(context, checkRun, meta)) return context

    let pr = await context.github.pullRequests.get(context.repo({number: checkRun.pull_requests[0].number}))
    context.payload.action = meta.action
    context.event = meta.event
    context.payload.pull_request = pr.data
    return context
  }

  possibleInjection (context, checkRun, meta) {
    let isInjection = checkRun.id !== meta.id
    if (isInjection) context.log.child('mergeable').warn('ids in payload do not match. Potential injection.')
    return isInjection
  }

  /**
   * Parses the chekrun output text for the JSON
   * i.e. <!-- #mergeable-data { "id": "123", "event": "pull_request", "action": "unlabeled" } #mergeable-data -->
   *
   * @return JSON object of mergeable data.
   */
  parseEventAction (text) {
    let begin = text.indexOf(DATA_START) + DATA_START.length
    let end = text.indexOf(DATA_END)
    let jsonString = text.substring(begin, end)
    return JSON.parse(jsonString.trim())
  }
}

module.exports = CheckReRun