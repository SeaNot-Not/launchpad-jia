import { guid } from "@/lib/Utils";
import Swal from "sweetalert2";
import axios from "axios";
import { useEffect, useState } from "react";
import { errorToast, interviewQuestionCategoryMap, candidateActionToast } from "@/lib/Utils";
import InterviewQuestionModal from "./InterviewQuestionModal";
import FullScreenLoadingAnimation from "./FullScreenLoadingAnimation";
import { assetConstants } from "@/lib/utils/constantsV2";

export default function (props) {
  const { questions, setQuestions, jobTitle, description, hasError } = props;
  const [questionGenPrompt, setQuestionGenPrompt] = useState("");
  const questionCount = 5;
  const [showQuestionModal, setShowQuestionModal] = useState("");
  const [questionModalGroupId, setQuestionModalGroupId] = useState(0);
  const [questionModalQuestion, setQuestionModalQuestion] = useState(null);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);

  function addQuestion(groupId: number, newQuestion: string) {
    const categoryIndex = questions.findIndex((q) => q.id === groupId);
    if (categoryIndex !== -1) {
      const updatedQuestions = [...questions];
      updatedQuestions[categoryIndex].questions = [
        ...updatedQuestions[categoryIndex].questions,
        {
          id: guid(),
          question: newQuestion,
        },
      ];

      setQuestions(updatedQuestions);
    }
  }

  function editQuestion(groupId, updatedQuestion, questionId) {
    const categoryIndex = questions.findIndex((q) => q.id === groupId);

    const updatedQuestions = [...questions];
    if (categoryIndex !== -1) {
      updatedQuestions[categoryIndex].questions = updatedQuestions[categoryIndex].questions.map((q) => (q.id === questionId ? { ...q, question: updatedQuestion } : q));
    }

    setQuestions(updatedQuestions);
  }

  function deleteQuestion(groupId, questionId) {
    const categoryIndex = questions.findIndex((q) => q.id === groupId);
    const updatedQuestions = [...questions];

    if (categoryIndex !== -1) {
      let categoryToUpdate = updatedQuestions[categoryIndex];
      categoryToUpdate.questions = categoryToUpdate.questions.filter((q) => q.id !== questionId);
      if (categoryToUpdate.questionCountToAsk !== null && categoryToUpdate.questionCountToAsk > categoryToUpdate.questions.length) {
        categoryToUpdate.questionCountToAsk = categoryToUpdate.questions.length;
      }
    }
    setQuestions(updatedQuestions);
  }

  async function generateAllQuestions() {
    try {
      if (!jobTitle.trim() || !description.trim()) {
        errorToast("Please fill in all fields", 1500);
        return;
      }

      setIsGeneratingQuestions(true);

      const interviewCategories = Object.keys(interviewQuestionCategoryMap);
      const response = await axios.post("/api/llm-engine", {
        systemPrompt: "You are a helpful assistant that can answer questions and help with tasks.",
        prompt: `Generate ${questionCount * interviewCategories.length} interview questions for the following Job opening: 
        Job Title:
        ${jobTitle} 
        Job Description:
        ${description}
  
        ${interviewCategories
          .map((category) => {
            return `Category:
          ${category}
          Category Description:
          ${interviewQuestionCategoryMap[category].description}`;
          })
          .join("\n")}
  
        ${interviewCategories.map((category) => `${questionCount} questions for ${category}`).join(", ")}

        ${
          questions.reduce((acc, group) => acc + group.questions.length, 0) > 0
            ? `Do not generate questions that are already covered in this list:\n${questions
                .map((group) => group.questions.map((question, index) => `          ${index + 1}. ${question.question}`).join("\n"))
                .join("\n")}`
            : ""
        }
        
        return it in json format following this for each element {category: "category", questions: ["question1", "question2", "question3", "question4", "question5"]}
        return only the json array, nothing else, now markdown format just pure json code.
        `,
      });

      let finalGeneratedQuestions = response.data.result;

      finalGeneratedQuestions = finalGeneratedQuestions.replace("```json", "");
      finalGeneratedQuestions = finalGeneratedQuestions.replace("```", "");

      finalGeneratedQuestions = JSON.parse(finalGeneratedQuestions);
      console.log(finalGeneratedQuestions);

      let newArray = [...questions];

      finalGeneratedQuestions.forEach((questionGroup) => {
        const categoryIndex = newArray.findIndex((q) => q.category === questionGroup.category);

        if (categoryIndex !== -1) {
          const newQuestions = questionGroup.questions.map((q) => ({
            id: guid(),
            question: q,
          }));
          newArray[categoryIndex].questions = [...newArray[categoryIndex].questions, ...newQuestions];
        }
      });

      setQuestions(newArray);

      candidateActionToast(
        <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27", marginLeft: 8 }}>Questions generated successfully</span>,
        1500,
        <i className="la la-check-circle" style={{ color: "#039855", fontSize: 32 }}></i>
      );
    } catch (err) {
      console.log(err);
      errorToast("Error generating questions, please try again", 1500);
    } finally {
      setIsGeneratingQuestions(false);
    }
  }

  async function generateQuestions(groupCategory: string) {
    try {
      if (!jobTitle.trim() || !description.trim()) {
        errorToast("Please fill in all fields", 1500);
        return;
      }

      setIsGeneratingQuestions(true);

      const interviewQuestionCategory = interviewQuestionCategoryMap[groupCategory];
      const response = await axios.post("/api/llm-engine", {
        systemPrompt: "You are a helpful assistant that can answer questions and help with tasks.",
        prompt: `Generate ${questionCount} interview questions for the following Job opening: 
          Job Title:
          ${jobTitle} 
          Job Description:
          ${description}
    
          Interview Category:
          ${groupCategory}
          Interview Category Description:
          ${interviewQuestionCategory.description}
    
          The ${questionCount} interview questions should be related to the job description and follow the scope of the interview category.

          ${
            questions.reduce((acc, group) => acc + group.questions.length, 0) > 0
              ? `Do not generate questions that are already covered in this list:\n${questions
                  .map((group) => group.questions.map((question, index) => `          ${index + 1}. ${question.question}`).join("\n"))
                  .join("\n")}`
              : ""
          }
          
          return it as a json object following this format for the category {category: "${groupCategory}", questions: ["question1", "question2", "question3"]}
          
          ${questionGenPrompt}
          `,
      });

      let finalGeneratedQuestions = response.data.result;

      finalGeneratedQuestions = finalGeneratedQuestions.replace("```json", "");
      finalGeneratedQuestions = finalGeneratedQuestions.replace("```", "");

      finalGeneratedQuestions = JSON.parse(finalGeneratedQuestions);
      console.log(finalGeneratedQuestions);

      let newArray = [...questions];

      const categoryIndex = newArray.findIndex((q) => q.category === finalGeneratedQuestions.category);

      if (categoryIndex !== -1) {
        const newQuestions = finalGeneratedQuestions.questions.map((q) => ({
          id: guid(),
          question: q,
        }));
        newArray[categoryIndex].questions = [...newArray[categoryIndex].questions, ...newQuestions];
      }

      setQuestions(newArray);

      candidateActionToast(
        <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27", marginLeft: 8 }}>Questions generated successfully</span>,
        1500,
        <i className="la la-check-circle" style={{ color: "#039855", fontSize: 32 }}></i>
      );
    } catch (err) {
      console.log(err);
      errorToast("Error generating questions, please try again", 1500);
    } finally {
      setIsGeneratingQuestions(false);
    }
  }

  function handleReorderCategories(draggedCategoryId: number, dropIndex: number) {
    const updatedQuestions = [...questions];
    const draggedCategoryIndex = updatedQuestions.findIndex((q) => q.id === draggedCategoryId);
    const draggedCategory = updatedQuestions[draggedCategoryIndex];

    // Remove the dragged category from the array
    updatedQuestions.splice(draggedCategoryIndex, 1);

    updatedQuestions.splice(dropIndex, 0, draggedCategory);
    setQuestions(updatedQuestions);
  }

  function handleReorderQuestions(draggedQuestionId: string, fromCategoryId: number, toCategoryId: number, insertIndex?: number) {
    const updatedQuestions = [...questions];

    // Find source category and question
    const fromCategoryIndex = updatedQuestions.findIndex((q) => q.id === fromCategoryId);
    const categoryOrigin = updatedQuestions[fromCategoryIndex];
    const questionIndex = categoryOrigin.questions.findIndex((q) => q.id.toString() === draggedQuestionId);
    const questionToMove = categoryOrigin.questions[questionIndex];

    // Remove from source category
    categoryOrigin.questions.splice(questionIndex, 1);

    // If moving within the same category
    if (fromCategoryId === toCategoryId) {
      // Insert at the specified index
      const targetIndex = insertIndex ?? 0;
      categoryOrigin.questions.splice(targetIndex, 0, questionToMove);
    } else {
      // Moving to different category - add to end
      const toCategoryIndex = updatedQuestions.findIndex((q) => q.id === toCategoryId);
      updatedQuestions[toCategoryIndex].questions.push(questionToMove);

      if (categoryOrigin.questionCountToAsk !== null && categoryOrigin.questionCountToAsk > categoryOrigin.questions.length) {
        categoryOrigin.questionCountToAsk = categoryOrigin.questions.length;
      }
    }

    setQuestions(updatedQuestions);
  }

  async function fetchInstructionPrompt() {
    const configData = await axios
      .post("/api/fetch-global-settings", {
        fields: { question_gen_prompt: 1 },
      })
      .then((res) => {
        return res.data;
      })
      .catch((err) => {
        console.log("[Question Generator Fetch Prompt Error]", err);
      });

    setQuestionGenPrompt(configData.question_gen_prompt.prompt);
  }

  useEffect(() => {
    fetchInstructionPrompt();
  }, []);

  return (
    <>
      <div className="layered-card-middle">
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            padding: "5px 16px",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18, color: "#181D27", fontWeight: 700 }}>2. Interview Questions</span>

            <div
              style={{
                borderRadius: "45%",
                width: 38,
                height: 30,
                border: "1px solid #D5D9EB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15,
                backgroundColor: "#F8F9FC",
                color: "#363F72",
                fontWeight: 700,
              }}
            >
              {questions.reduce((acc, group) => acc + group.questions.length, 0)}
            </div>
          </div>

          <button
            className="btn"
            style={{
              width: "fit-content",
              background: "#181D27",
              color: "#fff",
              border: "1px solid #E9EAEB",
              padding: "9px 20px",
              borderRadius: "60px",
              cursor: "pointer",
              whiteSpace: "nowrap",
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
            onClick={() => {
              generateAllQuestions();
            }}
          >
            <img src={assetConstants.shiningStar} style={{ height: 23, width: 23 }} />
            <span style={{ fontSize: 16, fontWeight: 500 }}>Generate all questions</span>
          </button>
        </div>

        <div className="layered-card-content" style={{ gap: 0 }}>
          {/* Error Message */}
          {hasError && (
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
              <i className="la la-exclamation-circle text-danger" style={{ fontSize: 28, color: "#F04438" }} />
              <span style={{ color: "#D92D20", fontWeight: 500, margin: 0, fontSize: 14 }}>Please add at least 5 interview questions.</span>
            </div>
          )}

          <div className="questions-set" style={{ gap: 0 }}>
            {questions.map((group, index) => (
              <div
                className="question-group"
                style={{ marginBottom: 0, padding: "32px 10px" }}
                key={index}
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData("categoryId", group.id.toString());
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  const target = e.currentTarget;
                  const bounding = target.getBoundingClientRect();
                  const offset = bounding.y + bounding.height / 2;

                  if (e.clientY - offset > 0) {
                    target.style.borderBottom = "3px solid";
                    target.style.borderImage = "linear-gradient(90deg, #9fcaed 0%, #ceb6da 33%, #ebacc9 66%, #fccec0 100%) 1";
                    target.style.borderTop = "none";
                  } else {
                    target.style.borderTop = "3px solid";
                    target.style.borderImage = "linear-gradient(90deg, #9fcaed 0%, #ceb6da 33%, #ebacc9 66%, #fccec0 100%) 1";
                    target.style.borderBottom = "none";
                  }
                }}
                onDragLeave={(e) => {
                  e.currentTarget.style.borderTop = "none";
                  e.currentTarget.style.borderBottom = "none";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderTop = "none";
                  e.currentTarget.style.borderBottom = "none";

                  const bounding = e.currentTarget.getBoundingClientRect();
                  const offset = bounding.y + bounding.height / 2;
                  const insertIndex = e.clientY - offset > 0 ? index + 1 : index;

                  const categoryId = Number(e.dataTransfer.getData("categoryId"));
                  if (!isNaN(categoryId) && categoryId !== group.id) {
                    // This is a category being dragged
                    handleReorderCategories(categoryId, insertIndex);
                  }

                  const draggedQuestionId = e.dataTransfer.getData("questionId");
                  const fromCategoryId = Number(e.dataTransfer.getData("fromCategoryId"));
                  if (draggedQuestionId && !isNaN(fromCategoryId)) {
                    // This is a question being dragged
                    handleReorderQuestions(draggedQuestionId, fromCategoryId, group.id);
                  }
                }}
              >
                {/* Row of category */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", height: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <h3
                      style={{
                        whiteSpace: "nowrap",
                        minWidth: "fit-content",
                        marginRight: "10px",
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#181D27",
                      }}
                    >
                      {group.category}
                    </h3>
                  </div>

                  {/* Row of questions */}
                  {group.questions.map((question, index) => (
                    <div
                      className="question-item"
                      style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", height: "100%", borderRadius: "16px" }}
                      key={index}
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("questionId", question.id.toString());
                        e.dataTransfer.setData("fromCategoryId", group.id.toString());
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        const target = e.currentTarget;
                        const bounding = target.getBoundingClientRect();
                        const offset = bounding.y + bounding.height / 2;

                        // Add visual indicator for drop position
                        if (e.clientY - offset > 0) {
                          target.style.borderBottom = "2px solid";
                          target.style.borderImage = "linear-gradient(90deg, #9fcaed 0%, #ceb6da 33%, #ebacc9 66%, #fccec0 100%) 1";
                          target.style.borderTop = "none";
                        } else {
                          target.style.borderTop = "2px solid";
                          target.style.borderImage = "linear-gradient(90deg, #9fcaed 0%, #ceb6da 33%, #ebacc9 66%, #fccec0 100%) 1";
                          target.style.borderBottom = "none";
                        }
                      }}
                      onDragLeave={(e) => {
                        // Remove visual indicators
                        e.currentTarget.style.borderTop = "none";
                        e.currentTarget.style.borderBottom = "none";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation(); // Prevent bubbling to question-group handler

                        // Remove visual indicators
                        e.currentTarget.style.borderTop = "none";
                        e.currentTarget.style.borderBottom = "none";

                        const draggedQuestionId = e.dataTransfer.getData("questionId");
                        const fromCategoryId = Number(e.dataTransfer.getData("fromCategoryId"));

                        if (draggedQuestionId && !isNaN(fromCategoryId)) {
                          const bounding = e.currentTarget.getBoundingClientRect();
                          const offset = bounding.y + bounding.height / 2;
                          const insertIndex = e.clientY - offset > 0 ? index + 1 : index;

                          handleReorderQuestions(draggedQuestionId, fromCategoryId, group.id, insertIndex);
                        }
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 12, height: "100%" }}>
                        <i className="la la-grip-vertical" style={{ fontSize: 20, color: "#A4A7AE" }} />
                        <span style={{ wordBreak: "break-word", whiteSpace: "pre-line", color: "#414651", fontWeight: 500 }}>{question.question}</span>
                      </div>

                      <div className="button-set" style={{ gap: 8, display: "flex", alignItems: "center", flexDirection: "row" }}>
                        <button
                          className="btn"
                          style={{
                            width: "fit-content",
                            color: "#414651",
                            background: "#fff",
                            border: "1px solid #D5D7DA",
                            padding: "9px 14px",
                            borderRadius: "60px",
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 0,
                          }}
                          onClick={() => {
                            setShowQuestionModal("edit");
                            setQuestionModalGroupId(group.id);
                            setQuestionModalQuestion(question);
                          }}
                        >
                          <i className="la la-pencil-alt" style={{ fontSize: 24 }} />
                          <span style={{ fontSize: 16, fontWeight: 500 }}>Edit</span>
                        </button>

                        <button
                          className="btn"
                          style={{
                            color: "#C01048",
                            background: "#FFF1F3",
                            border: "1px solid #FECCD6",
                            borderRadius: "50%",
                            width: 40,
                            height: 41,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 0,
                          }}
                          onClick={() => {
                            setShowQuestionModal("delete");
                            setQuestionModalGroupId(group.id);
                            setQuestionModalQuestion(question);
                          }}
                        >
                          <i className="la la-trash" style={{ fontSize: 24 }} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Buttons to add or generate questions */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button
                        className="btn"
                        style={{
                          width: "fit-content",
                          background: "#181D27",
                          color: "#fff",
                          border: "1px solid #E9EAEB",
                          padding: "9px 20px",
                          borderRadius: "60px",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                        onClick={() => {
                          generateQuestions(group.category);
                        }}
                      >
                        <img src={assetConstants.shiningStar} style={{ height: 23, width: 23 }} />
                        <span style={{ fontSize: 16, fontWeight: 500 }}>Generate questions</span>
                      </button>

                      <button
                        className="btn"
                        style={{
                          width: "fit-content",
                          color: "#414651",
                          background: "#fff",
                          border: "1px solid #D5D7DA",
                          padding: "9px 14px",
                          borderRadius: "60px",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 0,
                        }}
                        onClick={() => {
                          setShowQuestionModal("add");
                          setQuestionModalGroupId(group.id);
                        }}
                      >
                        <i className="la la-plus-circle" style={{ fontSize: 24 }} />
                        <span style={{ fontSize: 16, fontWeight: 500 }}>Manually add</span>
                      </button>
                    </div>

                    {group.questions.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <span
                          style={{
                            color: "#717680",
                            fontWeight: 500,
                          }}
                        >
                          # of questions to ask
                        </span>

                        <input
                          className="input"
                          type="number"
                          id="questionCount"
                          placeholder={questionCount.toString()}
                          value={group.questionCountToAsk !== null ? group.questionCountToAsk : ""}
                          max={group.questions.length}
                          min={0}
                          style={{
                            border: "2px solid #E9EAEB",
                            borderRadius: "8px",
                            padding: "10px 3px",
                            fontWeight: 500,
                            color: "#181D27",
                            fontSize: 16,
                            textAlign: "center",
                          }}
                          onChange={(e) => {
                            let value = parseInt(e.target.value);

                            if (isNaN(value)) {
                              value = null;
                            }

                            if (value > group.questions.length) {
                              value = group.questions.length;
                            }

                            // Update the input's displayed value to match the parsed number
                            e.target.value = value === null ? "" : value.toString();

                            const updatedQuestions = [...questions];
                            updatedQuestions[index].questionCountToAsk = value;
                            setQuestions(updatedQuestions);
                          }}
                          onKeyDown={(e) => {
                            // Prevent non-numeric input except for backspace, delete, and arrow keys
                            if (!/[0-9]/.test(e.key) && !["Backspace", "Delete", "ArrowLeft", "ArrowRight"].includes(e.key)) {
                              e.preventDefault();
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showQuestionModal && (
        <InterviewQuestionModal
          groupId={questionModalGroupId}
          questionToEdit={questionModalQuestion}
          action={showQuestionModal}
          onAction={(action, groupId, question, questionId) => {
            setShowQuestionModal("");
            setQuestionModalQuestion(null);
            setQuestionModalGroupId(0);

            if (action === "add" && groupId && question) {
              addQuestion(groupId, question);
            }

            if (action === "edit" && groupId && question && questionId) {
              editQuestion(groupId, question, questionId);
            }

            if (action === "delete" && groupId && questionId) {
              deleteQuestion(groupId, questionId);
            }
          }}
        />
      )}
      {isGeneratingQuestions && <FullScreenLoadingAnimation title="Generating questions..." subtext="Please wait while Jia is generating the questions" />}
    </>
  );
}
