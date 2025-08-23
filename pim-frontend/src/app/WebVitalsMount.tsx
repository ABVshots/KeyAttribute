'use client';

import WebVitalsClient from './WebVitalsClient';

export default function WebVitalsMount() {
  if (process.env.NODE_ENV !== 'development') return null;
  return <WebVitalsClient />;
}
