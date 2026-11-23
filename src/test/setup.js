// [공통 파일] 테스트 공통 준비: 가짜 IndexedDB, 테스트 모드 지연 없애기
import 'fake-indexeddb/auto'
import { testOptions } from '../api/providers/test.js'

testOptions.chunkDelayMs = 0
