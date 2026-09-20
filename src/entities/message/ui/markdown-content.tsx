import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { openUrl } from '@tauri-apps/plugin-opener'

interface IProps {
	content: string
}

/** Only http(s) links leave the app; anything else (javascript:, data:,
 *  relative) renders as plain text so model output can't navigate the
 *  webview or run scripts. */
const isExternal = (href: string) =>
	/^(https?:\/\/)/i.test(href.trim())

/**
 * Markdown renderer for assistant messages. Deliberately unstyled tags —
 * the typography lives in the container's Tailwind classes so everything
 * shares the chat's text scale.
 */
export const MarkdownContent = memo(({ content }: IProps) => (
	<ReactMarkdown
		remarkPlugins={[remarkGfm]}
		components={{
				p: ({ children }) => <p className='mb-3 last:mb-0'>{children}</p>,
				h1: ({ children }) => (
					<h1 className='mb-3 mt-5 text-xl font-semibold first:mt-0'>
						{children}
					</h1>
				),
				h2: ({ children }) => (
					<h2 className='mb-2.5 mt-5 text-lg font-semibold first:mt-0'>
						{children}
					</h2>
				),
				h3: ({ children }) => (
					<h3 className='mb-2 mt-4 text-base font-semibold first:mt-0'>
						{children}
					</h3>
				),
				ul: ({ children }) => (
					<ul className='mb-3 ml-5 list-disc space-y-1 last:mb-0'>
						{children}
					</ul>
				),
				ol: ({ children }) => (
					<ol className='mb-3 ml-5 list-decimal space-y-1 last:mb-0'>
						{children}
					</ol>
				),
				li: ({ children }) => <li className='pl-1'>{children}</li>,
				blockquote: ({ children }) => (
					<blockquote className='mb-3 border-l-2 border-border pl-3 text-muted-foreground last:mb-0'>
						{children}
					</blockquote>
				),
				hr: () => <hr className='my-4 border-border' />,
			a: ({ children, href }) => {
				if (!href || !isExternal(href)) return <>{children}</>
				return (
					<a
						href={href}
						target='_blank'
						rel='noopener noreferrer'
						onClick={event => {
							// Never navigate the webview itself — hand the URL
							// to the OS browser via the opener plugin.
							event.preventDefault()
							openUrl(href).catch(() => {})
						}}
						className='text-foreground underline underline-offset-3 hover:text-muted-foreground'
					>
						{children}
					</a>
				)
			},
				code: ({ className, children }) => {
					const isBlock = /language-/.test(className ?? '')
				if (isBlock) {
					return (
						<code className='block font-mono text-[13px] leading-relaxed'>
							{children}
						</code>
					)
				}
				return (
					<code className='rounded-[4px] bg-foreground/10 px-1 py-0.5 font-mono text-[13px]'>
						{children}
					</code>
				)
				},
			pre: ({ children }) => (
				<pre className='mb-3 overflow-x-auto rounded-lg bg-[#141414] border p-3.5 last:mb-0'>
					{children}
				</pre>
			),
				table: ({ children }) => (
					<div className='mb-3 overflow-x-auto last:mb-0'>
						<table className='w-full border-collapse text-sm'>{children}</table>
					</div>
				),
				th: ({ children }) => (
					<th className='border border-border bg-foreground/5 px-3 py-1.5 text-left font-medium'>
						{children}
					</th>
				),
				td: ({ children }) => (
					<td className='border border-border px-3 py-1.5'>{children}</td>
				)
			}}
		>
		{content}
	</ReactMarkdown>
))

MarkdownContent.displayName = 'MarkdownContent'
