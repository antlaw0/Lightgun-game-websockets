 `;
  try {
    const response = await axios.post(`${quinServerUrl}/v1/completions`, {
      model: model,
      prompt: prompt,
      max_tokens: contextLength,
      temperature: 0.2,
    });
    return response.data.choices[0].text;
  } catch (err) {
    console.error(`❌ AI request failed for chunk of ${filePath}:`, err.message);
    return contentChunk; // fallback: leave original
  }
}

// === STEP 4: Process file chunks sequentially ===
async function processFile(filePath, instruction) {
  const content = fs.readFileSync(filePath, "utf8");
  const chunks = splitFile(content);
  const editedChunks = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`Processing chunk ${i + 1}/${chunks.length} of ${filePath}`);
    const edited = await sendToQuin(filePath, chunks[i], instruction);
    editedChunks.push(edited);
  }

  const finalContent = editedChunks.join("\n");
  fs.writeFileSync(filePath, finalContent, "utf8");
  console.log(`✅ Updated file: ${filePath}`);
}

// === MAIN ===
async function main() {
  const instruction = process.argv.slice(2).join(" ");
  if (!instruction) {
    console.error("Provide an instruction, e.g.: node edit-project-auto-quin-chunked.js \"Fix empty click behavior\"");
    process.exit(1);
  }

  const projectFiles = getProjectFiles(projectRoot);
  console.log("Project JS files found:\n", projectFiles);

  for (const filePath of projectFiles) {
    await processFile(filePath, instruction);
  }

  console.log("✅ All files processed!");
}

main();




