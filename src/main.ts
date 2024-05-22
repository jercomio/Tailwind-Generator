import { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import { openai } from "./openai/openai";
import { SYSTEM_PROMPT } from "./openai/systemPrompt";

const form = document.querySelector('#generate-form') as HTMLFormElement;
const iframe = document.querySelector('#generated-code') as HTMLIFrameElement;
const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;

let messages: Array<ChatCompletionMessageParam> = [
  {
    role: 'system',
    content: SYSTEM_PROMPT
  }
]

form.addEventListener('submit', async (e) => {
  e.preventDefault()

  if (fieldset.disabled) {
    return
  }
  
  const formData = new FormData(form);
  const prompt = formData.get('prompt') as string

  if (!prompt) {
    return
  }

  let openaiKey = localStorage.getItem("openai-key") ?? ""

  if (!openaiKey) {
    const newKey = window.prompt("Please enter your OpenAI API key:")

    if (!newKey) {
      return
    }

    localStorage.setItem("openai-key", newKey)
    openaiKey = newKey
  }

  messages.push({
    role: 'user',
    content: prompt
  })
  renderMessage()
  
  fieldset.disabled = true

  const response = await openai(openaiKey).chat.completions.create({
    model: 'gpt-3.5-turbo',
    temperature: 1,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    max_tokens: 1500,
    stream: true,
    messages,
  });

  let code = ''
  const onNewChunk = createTimedUpdateIframe()

  for await (const message of response) {
    const isDone = message.choices[0].finish_reason === 'stop'
    const token = message.choices[0].delta.content
    
    if (isDone) {
      form.reset()
      fieldset.disabled = false
      messages = messages.filter((message) => message.role !== 'assistant')
      messages.push({
        role: 'assistant',
        content: code
      })
      return
    }
    code += token
    onNewChunk(code)
  }
})

const createTimedUpdateIframe = () => {
  let date = new Date()
  let timeout: any = null

  return (code: string) => {
    // Only call updateIframe if the last call was more than 1s ago
    if (new Date().getTime() - date.getTime() > 1000) {
      updateIframe(code)
      date = new Date()
    }

    // Clear the previous timeout
    if (timeout) {
      clearTimeout(timeout)
    }
    // Set a new timeout
    timeout = setTimeout(() => {
      updateIframe(code)
    }, 1000)
  }
}

const updateIframe = (code: string) => {
  iframe.srcdoc = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Generated HTML</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body>
      ${code}
    </body>
  </html>
  `
}

const renderMessage = () => {
  const ul = document.querySelector('#messages') as HTMLUListElement
  ul.innerHTML = ''

  for (const message of messages) {
    if (message.role !== 'user') {
      continue
    }

    const li = document.createElement('li')
    li.innerText = `You: ${message.content}`
    ul.appendChild(li)
  }
}
