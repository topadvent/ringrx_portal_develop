import Component from '@ember/component'
import { computed } from '@ember/object'
import { task } from 'ember-concurrency'
import { inject as service } from '@ember/service'

export default Component.extend({
  dragCoordinator: service(),
  notifications: service('notification-messages'),
  shifts: [],
  classNames: 'main-content push-p0',
  showSaveButton: false,
  showSortSaveButton: false,
  showValidations: false,
  resetEditState: false,
  userProperties: {},
  enableSort: computed.not('showSaveButton'),
  enableAddShift: computed.not('showSortSaveButton'),
  showActions: computed.not('showSortSaveButton'),

  isNotEmptyRepeated: computed('repeatedShifts', function(){
    return !Ember.isEmpty(this.get('repeatedShifts'))
  }),

  repeatedShifts: computed('shifts.length', 'shifts.@each.id', 'shifts.@each.priority', function () {
    return this.get('shifts').filter((shift) => {
      return !shift.get('startAt') && shift.get('id')
    }).sortBy('priority')
  }),

  oneTimeShifts: computed('shifts.length', 'shifts.@each.id', 'shifts.@each.priority', function () {
    return this.get('shifts').filter((shift) => {
      return !!shift.get('startAt') && shift.get('id')
    }).sortBy('priority')
  }),

  newShifts: computed('shifts.length', 'shifts.@each.id', function () {
    return this.get('shifts').filter((shift) => {
      return !shift.get('id')
    }).sortBy('priority')
  }),

  addNewShift: task(function * () {
    let response
    yield response = this.get('addOneTimeShift')(this.get('shifts'), this.get('currentDate'))
    if (!this.get('showSaveButton') && response == true) this.toggleProperty('showSaveButton')
  }).drop(),

  deleteShiftRecord: task(function * (shift) {
    let deletedPriority = shift.get('priority')
    if (!this.get('showSaveButton')) this.toggleProperty('showSaveButton')
    yield this.get('deleteRecord')(this.get('shifts'), shift)
  }).drop(),

  saveChanges: task(function * () {
    if (!this.get('showValidations')) this.toggleProperty('showValidations')
    let shiftsToSave = this.get('shifts').filterBy('startAt')
    if (shiftsToSave.every((shift) => {return shift.get('validations.isValid') })) {
      let resp = this.get('saveShifts')(shiftsToSave)
      resp.then(() => {
        this.set('showSaveButton', false)
        this.set('showSortSaveButton', false)
        this.set('showValidations', false)
        this.toggleProperty('resetEditState')
      })
      yield resp
    } else {
      this.get('notifications').error('Change a few things up and try submitting again.', {
        autoClear: true,
        clearDuration: 6200
      })
    }
  }).drop(),

  saveNewPriorities: task(function * () {
    let resp = this.get('updatePriority')()
    resp.then(() => {
      this.set('showSaveButton', false)
      this.set('showSortSaveButton', false)
      this.set('showValidations', false)
      this.toggleProperty('resetEditState')
    })
    yield resp
  }).drop(),

  willDestroyElement () {
    this.get('dragCoordinator').get('sortComponents')['drag-objects'] = Ember.A()
    if (this.get('showSaveButton') || this.get('showSortSaveButton')){
      this.get('rollbackTask').perform()
    }
  },

  rollbackTask: task(function * () {
      yield this.get('rollbackChanges')(this.get('shifts'))
    }
  ),

  actions: {
    toggleShowButton () {
      if (!this.get('showSaveButton')) this.toggleProperty('showSaveButton')
    },

    rollback () {
      this.sendAction('closeDialog')
    },

    sortEndAction () {
      this.get('moveShiftOnTop')(this.get('oneTimeShifts'))
      this.set('showSortSaveButton', true)
    },

    openCopyMode (shift) {
      this.sendAction('copyMode', shift)
    }
  }
})
