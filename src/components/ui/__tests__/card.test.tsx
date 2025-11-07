import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../card'

describe('Card Components', () => {
  describe('Card', () => {
    it('renders card correctly', () => {
      render(<Card data-testid="card">Card Content</Card>)
      expect(screen.getByTestId('card')).toBeInTheDocument()
    })

    it('applies custom className', () => {
      render(<Card className="custom-class" data-testid="card">Content</Card>)
      expect(screen.getByTestId('card')).toHaveClass('custom-class')
    })
  })

  describe('CardHeader', () => {
    it('renders card header correctly', () => {
      render(<CardHeader data-testid="header">Header Content</CardHeader>)
      expect(screen.getByTestId('header')).toBeInTheDocument()
    })

    it('applies custom className', () => {
      render(<CardHeader className="custom-header" data-testid="header">Header</CardHeader>)
      expect(screen.getByTestId('header')).toHaveClass('custom-header')
    })
  })

  describe('CardTitle', () => {
    it('renders card title correctly', () => {
      render(<CardTitle>Card Title</CardTitle>)
      expect(screen.getByText('Card Title')).toBeInTheDocument()
    })

    it('applies custom className', () => {
      render(<CardTitle className="custom-title" data-testid="title">Title</CardTitle>)
      expect(screen.getByTestId('title')).toHaveClass('custom-title')
    })
  })

  describe('CardDescription', () => {
    it('renders card description correctly', () => {
      render(<CardDescription>Description text</CardDescription>)
      expect(screen.getByText('Description text')).toBeInTheDocument()
    })

    it('applies custom className', () => {
      render(<CardDescription className="custom-desc" data-testid="desc">Desc</CardDescription>)
      expect(screen.getByTestId('desc')).toHaveClass('custom-desc')
    })
  })

  describe('CardContent', () => {
    it('renders card content correctly', () => {
      render(<CardContent data-testid="content">Content</CardContent>)
      expect(screen.getByTestId('content')).toBeInTheDocument()
    })

    it('applies custom className', () => {
      render(<CardContent className="custom-content" data-testid="content">Content</CardContent>)
      expect(screen.getByTestId('content')).toHaveClass('custom-content')
    })
  })

  describe('CardFooter', () => {
    it('renders card footer correctly', () => {
      render(<CardFooter data-testid="footer">Footer</CardFooter>)
      expect(screen.getByTestId('footer')).toBeInTheDocument()
    })

    it('applies custom className', () => {
      render(<CardFooter className="custom-footer" data-testid="footer">Footer</CardFooter>)
      expect(screen.getByTestId('footer')).toHaveClass('custom-footer')
    })
  })

  describe('Card Integration', () => {
    it('renders complete card structure', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Test Card</CardTitle>
            <CardDescription>This is a test description</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Card content goes here</p>
          </CardContent>
          <CardFooter>
            <button>Action</button>
          </CardFooter>
        </Card>
      )

      expect(screen.getByText('Test Card')).toBeInTheDocument()
      expect(screen.getByText('This is a test description')).toBeInTheDocument()
      expect(screen.getByText('Card content goes here')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /action/i })).toBeInTheDocument()
    })
  })
})
