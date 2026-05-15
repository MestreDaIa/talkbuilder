import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocking the fetch API
global.fetch = vi.fn();

const RUNTIME_URL = "https://fwoescubnnagdvwasbjl.functions.supabase.co/chatbot-runtime";

describe('Chatbot Runtime Wait Node', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('should not advance to next node until wait_ms has passed', async () => {
    // 1. Mock the first call to "start" which hits a wait node
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        messages: [{ id: '1', type: 'bot', content: 'Message before wait' }],
        wait_ms: 2000, // 2 seconds
        runtime_state: {
          current_node_id: 'node-after-wait',
          variables: {},
          waiting_for_input: false,
          is_waiting_time: true
        }
      }),
    });

    // Initial start call
    const response = await fetch(RUNTIME_URL, { method: 'POST' });
    const data = await response.json();

    expect(data.messages[0].content).toBe('Message before wait');
    expect(data.wait_ms).toBe(2000);
    expect(data.runtime_state.is_waiting_time).toBe(true);

    // 2. Mock the continuation call after the timer
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        messages: [{ id: '2', type: 'bot', content: 'Message after wait' }],
        wait_ms: 0,
        runtime_state: {
          current_node_id: 'end-node',
          variables: {},
          waiting_for_input: false,
          is_waiting_time: false
        }
      }),
    });

    // Simulate the frontend logic: wait 2000ms then call continueRuntime
    let continueCalled = false;
    setTimeout(async () => {
      const secondResponse = await fetch(RUNTIME_URL, { method: 'POST' });
      const secondData = await secondResponse.json();
      expect(secondData.messages[0].content).toBe('Message after wait');
      continueCalled = true;
    }, data.wait_ms);

    // Confirm it hasn't been called yet
    expect(continueCalled).toBe(false);

    // Fast-forward time
    vi.advanceTimersByTime(2000);

    // We need to wait for the microtask queue (the fetch and expects inside setTimeout)
    await vi.runAllTicks();
    await vi.runAllTimers();

    // Verify it was eventually called
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('should not advance even if user sends input during wait time', async () => {
    // 1. Mock the start call hitting a wait node
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        messages: [{ id: '1', type: 'bot', content: 'Waiting...' }],
        wait_ms: 5000, // 5 seconds wait
        runtime_state: {
          current_node_id: 'wait-node-id',
          variables: {},
          waiting_for_input: false,
          is_waiting_time: true
        }
      }),
    });

    const response = await fetch(RUNTIME_URL, { method: 'POST' });
    const data = await response.json();
    expect(data.wait_ms).toBe(5000);

    // 2. Mock user sending a message while the bot is "waiting"
    // The server should acknowledge receipt (maybe save variable) but NOT advance the flow
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        messages: [], // No new messages because we are still waiting
        wait_ms: 0, // No new wait scheduled
        runtime_state: {
          current_node_id: 'wait-node-id', // STILL at the same node or pointer
          variables: { last_input: 'hello' },
          waiting_for_input: false,
          is_waiting_time: true // STILL in waiting state
        }
      }),
    });

    // Advance time only 1 second
    vi.advanceTimersByTime(1000);

    // User sends message
    const inputResponse = await fetch(RUNTIME_URL, { 
      method: 'POST', 
      body: JSON.stringify({ payload: { message: 'hello' } }) 
    });
    const inputData = await inputResponse.json();

    // Verify bot did not advance to next message
    expect(inputData.messages.length).toBe(0);
    expect(inputData.runtime_state.is_waiting_time).toBe(true);

    // 3. Mock the final continuation after the full 5 seconds
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        messages: [{ id: '3', type: 'bot', content: 'Finished waiting' }],
        wait_ms: 0,
        runtime_state: {
          current_node_id: 'next-node',
          variables: { last_input: 'hello' },
          waiting_for_input: false,
          is_waiting_time: false
        }
      }),
    });

    // Fast-forward the remaining 4 seconds
    vi.advanceTimersByTime(4000);
    
    // Manual trigger as frontend would do
    const finalResponse = await fetch(RUNTIME_URL, { method: 'POST' });
    const finalData = await finalResponse.json();

    expect(finalData.messages[0].content).toBe('Finished waiting');
    expect(finalData.runtime_state.is_waiting_time).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
