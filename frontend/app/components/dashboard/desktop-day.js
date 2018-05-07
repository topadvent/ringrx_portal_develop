import Component from '@ember/component';
import { computed, observer } from '@ember/object'
import moment from 'moment'

export default Component.extend({
  classNameBindings: ['active'],
  currentDay: '',
  shifts: [],
  active: computed('currentDay', function (){
    if (moment().isSame(moment(this.get('currentDay'), 'YYYY-MM-DD'), 'days')){
      return 'item-coll active'
    } else {
      return 'item-coll'
    }
  }),

  dayName: computed('currentDay', function () {
    return moment(this.get('currentDay')).format('MMMM,D')
  }),

  weekday: computed('currentDay', function () {
    return moment(this.get('currentDay')).format('ddd')
  }),

  noShifts: computed.empty('shifts'),

  SortedShifts: computed(
    'shifts',
    'userProperties',
    'shifts.length',
    'shifts.@each.priority',
    'shifts.@each.name',
    'shifts.@each.startTime',
    'shifts.@each.endTime',
    'shifts.@each.startAt',
    'shifts.@each.endAt',
    'shifts.@each.metric', function () {
      let dayShifts = Ember.A()
      let dayIntervals = []
      let intervals = {}
      let response = []
      let currentDate = this.get('currentDay').split('-')
      this.get('shifts').forEach((shift) => {
        // create new shifts with identical format {id: '', start: '', end: '', priority: '', metric: '', isRepeated: boolean, users: 'name, name2'}
        let formattedShift = {}
        formattedShift['id'] = shift.get('id')
        //If there is startAt property then it is one time shift
        if (shift.get('startAt')) {
          formattedShift['start'] = moment(shift.get('startAt'))
          formattedShift['end'] = moment(shift.get('endAt'))
          formattedShift['isRepeated'] = false
        } else {
          let start = moment(shift.get('startTime'))
          let end = moment(shift.get('endTime'))
          formattedShift['start'] = moment(moment().year(currentDate[0]).month(currentDate[1] - 1).date(currentDate[2]).hour(start.hour()).minute(start.minute()).format())
          formattedShift['end'] = moment(moment().year(currentDate[0]).month(currentDate[1] - 1).date(currentDate[2]).hour(end.hour()).minute(end.minute()).format())
          if (end.isBefore(start) || (end.hours() == 0 && end.minutes() == 0)) {
            formattedShift['end'] = formattedShift['end'].add(1, 'days')
          }
          formattedShift['isRepeated'] = true
        }
        formattedShift['priority'] = shift.get('priority')
        formattedShift['metric'] = shift.get('metric')
        if (Ember.isEmpty(this.get('userProperties'))) {
          formattedShift['users'] = ''
        } else {
          formattedShift['users'] = shift.get('pbxOncallShiftUsers').sortBy('priority').map((user) => {
            return this.get('userProperties')[user.get('pbxUserId')]
          }).join(', ')
        }
        dayShifts.addObject(formattedShift)
      })
      //add all start and end times to dayIntervals
      dayShifts.forEach((shift) => {
        intervals[shift.start.format('YYYY-MM-DD HH:mm')]=shift.start
        intervals[shift.end.format('YYYY-MM-DD HH:mm')]=shift.end
      })
      // find only uniq times and sort them
      let intervalStrings = Object.keys(intervals).sort()
      intervalStrings.forEach((key)=>{
        dayIntervals.push(intervals[key])
      })
      //find which shift has priority on current interval
      //debugger;
      dayIntervals.forEach((startAtTime) => {
        if (startAtTime.date() == +currentDate[2]){
          let currentIntervalShifts = dayShifts.filter((shift) => {
            let shiftStart = shift.start
            let shiftEnd = shift.end
            return startAtTime.isSameOrAfter(shiftStart, 'minute') && startAtTime.isBefore(shiftEnd, 'minute')
          })

          let notRepeatedShifts = currentIntervalShifts.filter((shift) => !shift.isRepeated)
          let shift = null
          // if there is no not repeated shifts then try to get repeated shifts
          if (Ember.isEmpty(notRepeatedShifts)) {
            shift = currentIntervalShifts.filter((shift) => shift.isRepeated).sortBy('priority')[0]
          } else {
            // not repeated shifts has priority over repeated. So need to sort not repeated shifts by priority
            // and that take shift with lowest priority
            shift = notRepeatedShifts.sortBy('priority')[0]
          }

          if (shift) {
            if (Ember.isEmpty(response)) {
              // if there is no shifts in response than copy shift
              response.push(Object.assign({}, shift))
              //else check that previous shift is not the same with new shift that we want to add.
              // If they are the same, then go to next iteration, otherwise set last shift end time as time of current
              // interval. Copy new shift. Set start time to current interval time and then push to response
            } else if (response[response.length - 1].id !== shift.id) {
              if (response[response.length - 1].end.isAfter(startAtTime)) {
                response[response.length - 1].end = startAtTime
              }
              let copyShift = Object.assign({}, shift)
              copyShift.start = startAtTime
              response.push(copyShift)
            }
          }
        }
      })
      return response
    })
});
