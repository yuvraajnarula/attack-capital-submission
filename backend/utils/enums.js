const SessionStatus = Object.freeze({
  RECORDING: 'RECORDING',
  PAUSED: 'PAUSED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
});

const AudioSource = Object.freeze({
  MICROPHONE: 'MICROPHONE',
  TAB_SHARE: 'TAB_SHARE',
  SCREEN_SHARE: 'SCREEN_SHARE',
});

module.exports ={
    SessionStatus,
    AudioSource
}