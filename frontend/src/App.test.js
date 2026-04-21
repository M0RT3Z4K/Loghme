import { render, screen } from '@testing-library/react';
import App from './App';

test('redirects to login when not authenticated', () => {
  localStorage.clear();
  render(<App />);
  expect(screen.getByText(/لقمـه/i)).toBeInTheDocument();
});
