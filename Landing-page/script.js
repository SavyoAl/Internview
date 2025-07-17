async function getInterviewQuestion() {
  const role = "Marketing Intern"; // You can change this or make it dynamic later
  const company = "Google";

  try {
    const response = await fetch("http://localhost:5000/api/question", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ role, company })
    });

    const data = await response.json();

    // Insert the question into the page
    const questionElement = document.getElementById("question");
    questionElement.innerText = data.question;
  } catch (err) {
    console.error("Error fetching interview question:", err);
  }
}
