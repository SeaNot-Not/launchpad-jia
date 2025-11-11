"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import InterviewQuestionGeneratorForCareerForm from "./InterviewQuestionGeneratorForCareerForm";
import RichTextEditor from "@/lib/components/CareerComponents/RichTextEditor";
import CustomDropdown from "@/lib/components/CareerComponents/CustomDropdown";
import philippineCitiesAndProvinces from "../../../../public/philippines-locations.json";
import { candidateActionToast, errorToast } from "@/lib/Utils";
import { useAppContext } from "@/lib/context/AppContext";
import axios from "axios";
import CareerActionModal from "./CareerActionModal";
import FullScreenLoadingAnimation from "./FullScreenLoadingAnimation";
import { assetConstants } from "@/lib/utils/constantsV2";
import DOMPurify from "isomorphic-dompurify";

// Helpers
function cs(...styles: (React.CSSProperties | undefined | false)[]): React.CSSProperties {
  return Object.assign({}, ...styles.filter(Boolean));
} // Small helper to combine styles similar to cn in Tailwind

// Contants
// Setting List icons
const screeningSettingList = [
  {
    name: "Good Fit and above",
    icon: "la la-check",
  },
  {
    name: "Only Strong Fit",
    icon: "la la-check-double",
  },
  {
    name: "No Automatic Promotion",
    icon: "la la-times",
  },
];

const workSetupOptions = [
  {
    name: "Fully Remote",
  },
  {
    name: "Onsite",
  },
  {
    name: "Hybrid",
  },
];

const employmentTypeOptions = [
  {
    name: "Full-Time",
  },
  {
    name: "Part-Time",
  },
];

// ---------------------------------------------------------------------------------------------------------------------------------------------------------
export default function CareerForm({ career, formType, setShowEditModal }: { career?: any; formType: string; setShowEditModal?: (show: boolean) => void }) {
  // For Segmentation
  // Stepper
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<Step[]>([{ title: "Career Details" }, { title: "AI Interview Setup" }, { title: "Review Career" }]);

  console.log(career);

  // Variables in question list in career review
  let questionNumber = 1;

  // Segment Values

  // Form Values With Validation
  // Segment One
  const {
    values: segmentOneValues,
    errors: segmentOneErrors,
    handleChange: handleSegmentOneChange,
    validate: validateSegmentOne,
  } = useCareerFormValidation({
    // Basic Information
    jobTitle: career?.jobTitle || "",

    // Work Setting
    employmentType: career?.employmentType || "Full-Time",
    workSetup: career?.workSetup || "",
    // workSetupRemarks: career?.workSetupRemarks || "",

    // Location
    country: career?.country || "Philippines",
    province: career?.province || "",
    city: career?.location || "",

    // Salary
    salaryNegotiable: career?.salaryNegotiable || true,
    minimumSalary: career?.minimumSalary || "",
    maximumSalary: career?.maximumSalary || "",

    // Job Description
    description: career?.description || "",
  });

  // SegmentTwo
  // For Segmentation
  const {
    values: segmentTwoValues,
    errors: segmentTwoErrors,
    handleChange: handleSegmentTwoChange,
    validateQuestions: validateSegmentTwoQuestions,
    handleQuestionsChange: handleSegmentTwoQuestionsChange,
  } = useCareerFormValidation({
    // #1 AI Interview Settings
    screeningSetting: career?.screeningSetting || "Good Fit and above",
    requireVideo: career?.requireVideo || true,

    // #2 Interview Questions
    questions: career?.questions || [
      {
        id: 1,
        category: "CV Validation / Experience",
        questionCountToAsk: null,
        questions: [],
      },
      {
        id: 2,
        category: "Technical",
        questionCountToAsk: null,
        questions: [],
      },
      {
        id: 3,
        category: "Behavioral",
        questionCountToAsk: null,
        questions: [],
      },
      {
        id: 4,
        category: "Analytical",
        questionCountToAsk: null,
        questions: [],
      },
      {
        id: 5,
        category: "Others",
        questionCountToAsk: null,
        questions: [],
      },
    ],
  });

  // Form Data
  const { user, orgID } = useAppContext();

  const [provinceList, setProvinceList] = useState([]);
  const [cityList, setCityList] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState("");
  const [isSavingCareer, setIsSavingCareer] = useState(false);
  const savingCareerRef = useRef(false);
  const [savedCareerId, setSavedCareerId] = useState<string | null>(null);

  const updateCareer = async (status: string, isSegmentSave: boolean = false) => {
    // Use segmented values for validation
    if (Number(segmentOneValues.minimumSalary) && Number(segmentOneValues.maximumSalary) && Number(segmentOneValues.minimumSalary) > Number(segmentOneValues.maximumSalary)) {
      errorToast("Minimum salary cannot be greater than maximum salary", 1300);
      return;
    }

    let userInfoSlice = {
      image: user.image,
      name: user.name,
      email: user.email,
    };

    // Determine id to use for update: prefer existing career prop, otherwise use savedCareerId
    const careerId = career?._id || savedCareerId;
    if (!careerId) {
      errorToast("Cannot update career: missing career id", 1300);
      return;
    }

    const updatedCareer = {
      _id: careerId,
      jobTitle: segmentOneValues.jobTitle,
      description: segmentOneValues.description,
      workSetup: segmentOneValues.workSetup,
      // workSetupRemarks: segmentOneValues.workSetupRemarks,
      questions: segmentTwoValues.questions,
      lastEditedBy: userInfoSlice,
      status,
      updatedAt: Date.now(),
      screeningSetting: segmentTwoValues.screeningSetting,
      requireVideo: segmentTwoValues.requireVideo,
      salaryNegotiable: segmentOneValues.salaryNegotiable,
      minimumSalary: isNaN(Number(segmentOneValues.minimumSalary)) ? null : Number(segmentOneValues.minimumSalary),
      maximumSalary: isNaN(Number(segmentOneValues.maximumSalary)) ? null : Number(segmentOneValues.maximumSalary),
      country: segmentOneValues.country,
      province: segmentOneValues.province,
      // Backwards compatibility
      location: segmentOneValues.city,
      employmentType: segmentOneValues.employmentType,
    };

    try {
      setIsSavingCareer(true);
      const response = await axios.post("/api/update-career", updatedCareer);
      if (response.status === 200) {
        candidateActionToast(
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginLeft: 8,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>Career updated</span>
          </div>,
          1300,
          <i className="la la-check-circle" style={{ color: "#039855", fontSize: 32 }} />
        );
        // Only redirect if this is not a segment save
        if (!isSegmentSave) {
          setTimeout(() => {
            window.location.href = `/recruiter-dashboard/careers/manage/${careerId}`;
          }, 1300);
        }
      }
    } catch (error) {
      console.error(error);
      errorToast("Failed to update career", 1300);
    } finally {
      setIsSavingCareer(false);
    }
  };

  const confirmSaveCareer = (status: string) => {
    if (Number(segmentOneValues.minimumSalary) && Number(segmentOneValues.maximumSalary) && Number(segmentOneValues.minimumSalary) > Number(segmentOneValues.maximumSalary)) {
      errorToast("Minimum salary cannot be greater than maximum salary", 1300);
      return;
    }

    setShowSaveModal(status);
  };

  const saveCareer = async (status: string, isSegmentSave: boolean = false) => {
    setShowSaveModal("");
    if (!status) {
      return;
    }

    // Validate current step before saving
    if (!validateCurrentStep()) {
      return;
    }

    if (!savingCareerRef.current) {
      setIsSavingCareer(true);
      savingCareerRef.current = true;
      let userInfoSlice = {
        image: user.image,
        name: user.name,
        email: user.email,
      };
      const career = {
        jobTitle: segmentOneValues.jobTitle,
        description: segmentOneValues.description,
        workSetup: segmentOneValues.workSetup,
        // workSetupRemarks: segmentOneValues.workSetupRemarks,
        questions: segmentTwoValues.questions,
        lastEditedBy: userInfoSlice,
        createdBy: userInfoSlice,
        screeningSetting: segmentTwoValues.screeningSetting,
        orgID,
        requireVideo: segmentTwoValues.requireVideo,
        salaryNegotiable: segmentOneValues.salaryNegotiable,
        minimumSalary: isNaN(Number(segmentOneValues.minimumSalary)) ? null : Number(segmentOneValues.minimumSalary),
        maximumSalary: isNaN(Number(segmentOneValues.maximumSalary)) ? null : Number(segmentOneValues.maximumSalary),
        country: segmentOneValues.country,
        province: segmentOneValues.province,
        // Backwards compatibility
        location: segmentOneValues.city,
        status: isSegmentSave ? "inactive" : status, // Use inactive status for segment saves
        employmentType: segmentOneValues.employmentType,
      };

      try {
        const response = await axios.post("/api/add-career", career);
        if (response.status === 200) {
          // Capture returned id (either Mongo _id or custom id) so subsequent updates can reference it
          const returnedCareer = response.data?.career || null;
          const returnedId = returnedCareer?._id || returnedCareer?.id || null;
          if (returnedId) setSavedCareerId(String(returnedId));

          candidateActionToast(
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginLeft: 8,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>Career added {status === "active" ? "and published" : ""}</span>
            </div>,
            1300,
            <i className="la la-check-circle" style={{ color: "#039855", fontSize: 32 }} />
          );

          // If this save was for a segment (save and continue), do not redirect; caller will advance the step.
          if (!isSegmentSave) {
            setTimeout(() => {
              window.location.href = `/recruiter-dashboard/careers`;
            }, 1300);
          }
        }
      } catch (error) {
        console.log(error);
        errorToast("Failed to add career", 1300);
      } finally {
        savingCareerRef.current = false;
        setIsSavingCareer(false);
      }
    }
  };

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 0:
        const isSegmentOneValid = validateSegmentOne({
          jobTitle: { required: true, message: "Job title is required" },
          employmentType: { required: true, message: "Employment type is required" },
          workSetup: { required: true, message: "Work arrangement is required" },
          country: { required: true, message: "Country is required" },
          province: { required: true, message: "Province is required" },
          city: { required: true, message: "City is required" },
          salaryNegotiable: { required: false },
          minimumSalary: { required: true, message: "Minimum salary is required" },
          maximumSalary: { required: true, message: "Maximum salary is required" },
          description: { required: true, message: "Description is required" },
        });

        if (!isSegmentOneValid) {
          errorToast("Please fill out all required fields", 1300);
          return false;
        }
        return true;

      case 1:
        const isSegmentTwoValid = validateSegmentTwoQuestions();

        if (!isSegmentTwoValid) {
          errorToast("Please fill out all required fields", 1300);
          return false;
        }
        return true;

      case 2:
        // Review step - no validation needed
        return true;

      default:
        return true;
    }
  };

  // Checking Errors for Segment One
  useEffect(() => {
    // Update error state for current step based on validation errors
    const hasErrors = Object.keys(segmentOneErrors).length > 0;
    setSteps((prev) => prev.map((step, index) => (index === currentStep ? { ...step, hasError: hasErrors } : step)));
  }, [segmentOneErrors, currentStep]);

  // Checking Errors for Segment Two
  useEffect(() => {
    // Update error state for current step based on validation errors
    const hasErrors = Object.keys(segmentTwoErrors).length > 0;
    setSteps((prev) => prev.map((step, index) => (index === currentStep ? { ...step, hasError: hasErrors } : step)));
  }, [segmentTwoErrors, currentStep]);

  // Parsing Location
  useEffect(() => {
    const parseProvinces = () => {
      setProvinceList(philippineCitiesAndProvinces.provinces);
      const defaultProvince = philippineCitiesAndProvinces.provinces[0];
      if (!career?.province) {
        handleSegmentOneChange("province", defaultProvince.name);
      }
      const cities = philippineCitiesAndProvinces.cities.filter((city) => city.province === defaultProvince.key);
      setCityList(cities);
      if (!career?.location) {
        handleSegmentOneChange("city", cities[0].name);
      }
    };
    parseProvinces();
  }, [career]);

  return (
    <div className="col">
      {/* HEADER SECTION */}
      {formType === "add" ? (
        <CareerFormHeader title={segmentOneValues.jobTitle || "Add New Career"}>
          {currentStep > 0 && (
            <CareerActionButton variant="secondary" onClick={() => setCurrentStep((prev) => prev - 1)}>
              Back
            </CareerActionButton>
          )}

          {/* Save as Unpublished should be available on all segments */}
          <CareerActionButton
            variant="secondary"
            disabled={isSavingCareer}
            onClick={() => {
              // For add flow, we show modal confirmation
              confirmSaveCareer("inactive");
            }}
            customStyle={{ marginRight: 8 }}
          >
            Save as Unpublished
          </CareerActionButton>

          {currentStep < steps.length - 1 ? (
            // Save and Continue for segments 1 and 2
            <CareerActionButton
              variant="primary"
              disabled={isSavingCareer}
              onClick={async () => {
                if (validateCurrentStep()) {
                  // If we've already created the career (savedCareerId or existing career), update it; otherwise create it
                  if (career?._id || savedCareerId) {
                    await updateCareer("inactive", true);
                  } else {
                    await saveCareer("inactive", true);
                  }
                  setCurrentStep((prev) => prev + 1);
                }
              }}
              icon={<i className="la la-arrow-right" style={{ color: "#fff", fontSize: 24 }} />}
              iconPosition="right"
            >
              Save and Continue
            </CareerActionButton>
          ) : (
            // Final review: allow publishing
            <CareerActionButton
              variant="primary"
              disabled={isSavingCareer}
              onClick={() => {
                confirmSaveCareer("active");
              }}
              icon={<i className="la la-check-circle" style={{ color: "#fff", fontSize: 24 }} />}
            >
              Publish
            </CareerActionButton>
          )}
        </CareerFormHeader>
      ) : (
        <CareerFormHeader title={segmentOneValues.jobTitle || "Edit Career Details"} isCareerInactive={career?.status === "inactive"}>
          <CareerActionButton
            variant="secondary"
            onClick={() => {
              setShowEditModal?.(false);
            }}
          >
            Cancel
          </CareerActionButton>

          {/* Save as Unpublished available on all segments for edit flow */}
          <CareerActionButton
            variant="secondary"
            disabled={isSavingCareer}
            onClick={() => {
              updateCareer("inactive");
            }}
            customStyle={{ marginRight: 8 }}
          >
            Save Changes as Unpublished
          </CareerActionButton>

          {currentStep < steps.length - 1 ? (
            // Save and Continue for segments 1 and 2
            <CareerActionButton
              variant="primary"
              disabled={isSavingCareer}
              onClick={async () => {
                if (validateCurrentStep()) {
                  // save current edits as inactive and advance
                  await updateCareer("inactive", true);
                  setCurrentStep((prev) => prev + 1);
                }
              }}
              icon={<i className="la la-arrow-right" style={{ color: "#fff", fontSize: 24 }} />}
              iconPosition="right"
            >
              Save and Continue
            </CareerActionButton>
          ) : (
            // Final review: allow publishing
            <CareerActionButton
              variant="primary"
              disabled={isSavingCareer}
              onClick={() => {
                updateCareer("active");
              }}
              icon={<i className="la la-check-circle" style={{ color: "#fff", fontSize: 20, marginRight: 8 }} />}
            >
              Save Changes and Publish
            </CareerActionButton>
          )}
        </CareerFormHeader>
      )}

      {/* FOR SEGMENTATION SECTION: STEPPER COMPONENT */}
      <Stepper steps={steps} currentStep={currentStep} />

      <div style={{ width: "100%", border: "1px solid #E9EAEB", margin: "32px 0" }} />

      {/* Segments: render only the current step */}
      {/* Career Details */}
      {currentStep === 0 && (
        <CareerFormMainContainer>
          {/* LEFT SECTION */}
          <CareerFormSectionContainer style={{ width: "75%" }}>
            {/* CAREER INFORMATION */}
            <CareerFormSubSectionContainer number={1} title="Career Information">
              {/* Basic Information Section */}
              <FormSection title="Basic Information">
                <FormField label="Job Title" isError={!!segmentOneErrors.jobTitle}>
                  <input
                    value={segmentOneValues.jobTitle}
                    className="form-control"
                    placeholder="Enter job title"
                    onChange={(e) => handleSegmentOneChange("jobTitle", e.target.value)}
                    style={{ boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)", outline: segmentOneErrors.jobTitle ? "2px solid #FDA29B" : "none" }}
                  />
                  {segmentOneErrors.jobTitle && <p style={{ color: "red", fontWeight: 400, margin: 0, marginTop: "5px" }}>{segmentOneErrors.jobTitle}</p>}
                </FormField>
              </FormSection>

              {/* Work Setting Section */}
              <FormSection title="Work Setting">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "20px" }}>
                  <FormField label="Employment Type" isError={!!segmentOneErrors.employmentType}>
                    <CustomDropdown
                      onSelectSetting={(val) => handleSegmentOneChange("employmentType", val)}
                      screeningSetting={segmentOneValues.employmentType}
                      settingList={employmentTypeOptions}
                      placeholder="Select Employment Type"
                      isError={!!segmentOneErrors.employmentType}
                    />
                    {segmentOneErrors.employmentType && <p style={{ color: "red", fontWeight: 400, margin: 0, marginTop: "5px" }}>{segmentOneErrors.employmentType}</p>}
                  </FormField>

                  <FormField label="Arrangement" isError={!!segmentOneErrors.workSetup}>
                    <CustomDropdown
                      onSelectSetting={(setting) => handleSegmentOneChange("workSetup", setting)}
                      screeningSetting={segmentOneValues.workSetup}
                      settingList={workSetupOptions}
                      placeholder="Choose Work Arrangement"
                      isError={!!segmentOneErrors.workSetup}
                    />
                    {segmentOneErrors.workSetup && <p style={{ color: "red", fontWeight: 400, margin: 0, marginTop: "5px" }}>{segmentOneErrors.workSetup}</p>}
                  </FormField>
                </div>
              </FormSection>

              {/* Location Section */}
              <FormSection title="Location">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "20px" }}>
                  <FormField label="Country" isError={!!segmentOneErrors.country}>
                    <CustomDropdown
                      onSelectSetting={(setting) => handleSegmentOneChange("country", setting)}
                      screeningSetting={segmentOneValues.country}
                      settingList={[]}
                      placeholder="Select Country"
                      isError={!!segmentOneErrors.country}
                    />
                    {segmentOneErrors.country && <p style={{ color: "red", fontWeight: 400, margin: 0, marginTop: "5px" }}>{segmentOneErrors.country}</p>}
                  </FormField>

                  <FormField label="State / Province" isError={!!segmentOneErrors.province}>
                    <CustomDropdown
                      onSelectSetting={(prov) => {
                        handleSegmentOneChange("province", prov);
                        const provinceObj = provinceList.find((p) => p.name === prov);
                        const cities = philippineCitiesAndProvinces.cities.filter((city) => city.province === provinceObj.key);
                        setCityList(cities);
                        handleSegmentOneChange("city", cities[0].name);
                      }}
                      screeningSetting={segmentOneValues.province}
                      settingList={provinceList}
                      placeholder="Select State / Province"
                      isError={!!segmentOneErrors.province}
                    />
                    {segmentOneErrors.province && <p style={{ color: "red", fontWeight: 400, margin: 0, marginTop: "5px" }}>{segmentOneErrors.province}</p>}
                  </FormField>

                  <FormField label="City" isError={!!segmentOneErrors.city}>
                    <CustomDropdown
                      onSelectSetting={(c) => {
                        handleSegmentOneChange("city", c);
                      }}
                      screeningSetting={segmentOneValues.city}
                      settingList={cityList}
                      placeholder="Select City"
                      isError={!!segmentOneErrors.city}
                    />
                    {segmentOneErrors.city && <p style={{ color: "red", fontWeight: 400, margin: 0, marginTop: "5px" }}>{segmentOneErrors.city}</p>}
                  </FormField>
                </div>
              </FormSection>

              {/* Salary Section */}
              <FormSection>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                  <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>Salary</span>
                  <FormToggle
                    checked={segmentOneValues.salaryNegotiable}
                    onChange={() => handleSegmentOneChange("salaryNegotiable", !segmentOneValues.salaryNegotiable)}
                    label={segmentOneValues.salaryNegotiable ? "Negotiable" : "Not Negotiable"}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "20px" }}>
                  <FormField label="Minimum Salary" isError={!!segmentOneErrors.minimumSalary}>
                    <CurrencyInput value={segmentOneValues.minimumSalary} onChange={(val) => handleSegmentOneChange("minimumSalary", val)} placeholder="0" isError={!!segmentOneErrors.minimumSalary} />
                    {segmentOneErrors.minimumSalary && <p style={{ color: "red", fontWeight: 400, margin: 0, marginTop: "5px" }}>{segmentOneErrors.minimumSalary}</p>}
                  </FormField>

                  <FormField label="Maximum Salary" isError={!!segmentOneErrors.maximumSalary}>
                    <CurrencyInput value={segmentOneValues.maximumSalary} onChange={(val) => handleSegmentOneChange("maximumSalary", val)} placeholder="0" isError={!!segmentOneErrors.maximumSalary} />
                    {segmentOneErrors.maximumSalary && <p style={{ color: "red", fontWeight: 400, margin: 0, marginTop: "5px" }}>{segmentOneErrors.maximumSalary}</p>}
                  </FormField>
                </div>
              </FormSection>
            </CareerFormSubSectionContainer>

            <CareerFormSubSectionContainer number={2} title={"Job Description"}>
              <div>
                <RichTextEditor setText={(text) => handleSegmentOneChange("description", text)} text={segmentOneValues.description} isError={!!segmentOneErrors.description} />
                {segmentOneErrors.description && <p style={{ color: "red", fontWeight: 400, margin: 0, marginTop: "5px" }}>{segmentOneErrors.description}</p>}
              </div>
            </CareerFormSubSectionContainer>
            {/* JOB DESCRIPTION */}
          </CareerFormSectionContainer>

          {/* RIGHT SECTION */}
          <CareerFormSectionContainer style={{ width: "25%" }}>
            <CareerFormTipsContainer
              tips={[
                { highlightedText: "Use clear, standard job titles", text: 'for better searchability (e.g., "Software Engineer" instead of "Code Ninja" or "Tech Rockstar").' },
                {
                  highlightedText: "Avoid abbreviations",
                  text: 'or internal role codes that applicants may not understand (e.g., use "QA Engineer" instead of "QE II" or "QA-TL").',
                },
                {
                  highlightedText: "Keep it concise",
                  text: "– job titles should be no more than a few words (2–4 max), avoiding fluff or marketing terms.",
                },
              ]}
            />
          </CareerFormSectionContainer>
        </CareerFormMainContainer>
      )}

      {/* AI Interview Setup */}
      {currentStep === 1 && (
        <CareerFormMainContainer>
          {/* LEFT SECTION */}
          <CareerFormSectionContainer style={{ width: "75%" }}>
            <CareerFormSubSectionContainer number={1} title="AI Interview Settings">
              <FormSection title="AI Interview Screening">
                <FormField label="Jia automatically endorses candidates who meet the chosen criteria.">
                  <div style={{ width: "100%", maxWidth: "350px" }}>
                    <CustomDropdown
                      onSelectSetting={(setting) => handleSegmentTwoChange("screeningSetting", setting)}
                      screeningSetting={segmentTwoValues.screeningSetting}
                      settingList={screeningSettingList}
                    />
                  </div>
                </FormField>
              </FormSection>

              <div style={{ width: "100%", border: "1px solid #E9EAEB" }} />

              <FormSection title="Require Video on Interview">
                <FormField label="Require candidates to keep their camera on. Recordings will appear on their analysis page.">
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      justifyContent: "space-between",
                      gap: 8,
                      marginTop: "10px",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "row", gap: 8 }}>
                      <i className="la la-video" style={{ color: "#414651", fontSize: 25 }} />
                      <span style={{ color: "#414651", fontWeight: 500 }}>Require Video Interview</span>
                    </div>

                    <FormToggle
                      checked={segmentTwoValues.requireVideo}
                      onChange={() => handleSegmentTwoChange("requireVideo", !segmentTwoValues.requireVideo)}
                      label={segmentTwoValues.requireVideo ? "Yes" : "No"}
                    />
                  </div>
                </FormField>
              </FormSection>
            </CareerFormSubSectionContainer>

            <InterviewQuestionGeneratorForCareerForm
              questions={segmentTwoValues.questions}
              setQuestions={(questions) => handleSegmentTwoQuestionsChange(questions)}
              jobTitle={segmentOneValues.jobTitle}
              description={segmentOneValues.description}
              hasError={!!segmentTwoErrors.questions}
            />
          </CareerFormSectionContainer>

          {/* RIGHT SECTION */}
          <CareerFormSectionContainer style={{ width: "25%" }}>
            <CareerFormTipsContainer
              tips={[
                {
                  highlightedText: "Use “Generate Questions”",
                  text: "to quickly create tailored interview questions, then refine or mix them with your own for balanced results.",
                },
              ]}
            />
          </CareerFormSectionContainer>
        </CareerFormMainContainer>
      )}

      {currentStep === 2 && (
        <CareerFormMainContainer style={{ flexDirection: "column", maxWidth: "1246px", paddingBottom: "32px" }}>
          <CareerCollapseableContainer containerTitle="Career Details" onEditClick={() => setCurrentStep(0)}>
            {/* Job Title */}
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>Job Title</span>
              <span style={{ color: "#414651", fontWeight: 500 }}>{segmentOneValues.jobTitle}</span>
            </div>

            <div style={{ width: "100%", border: "1px solid #E9EAEB", margin: "10px 0" }} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
              {/* Employment Type */}
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>Employment Type</span>
                <span style={{ color: "#414651", fontWeight: 500 }}>{segmentOneValues.jobTitle}</span>
              </div>

              {/* Work Arrangement */}
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>Work Arrangement</span>
                <span style={{ color: "#414651", fontWeight: 500 }}>{segmentOneValues.jobTitle}</span>
              </div>
            </div>

            <div style={{ width: "100%", border: "1px solid #E9EAEB", margin: "10px 0" }} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
              {/* Country */}
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>Country</span>
                <span style={{ color: "#414651", fontWeight: 500 }}>{segmentOneValues.country}</span>
              </div>

              {/* State / Province */}
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>State / Province</span>
                <span style={{ color: "#414651", fontWeight: 500 }}>{segmentOneValues.province}</span>
              </div>

              {/* City */}
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>City</span>
                <span style={{ color: "#414651", fontWeight: 500 }}>{segmentOneValues.city}</span>
              </div>
            </div>

            <div style={{ width: "100%", border: "1px solid #E9EAEB", margin: "10px 0" }} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
              {/* Minimum Salary */}
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>Minimum Salary</span>
                <span style={{ color: "#414651", fontWeight: 500 }}>{segmentOneValues.salaryNegotiable ? "Negotiable" : segmentOneValues.minimumSalary}</span>
              </div>

              {/* Maximum Salary */}
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>Maximum Salary</span>
                <span style={{ color: "#414651", fontWeight: 500 }}>{segmentOneValues.salaryNegotiable ? "Negotiable" : segmentOneValues.maximumSalary}</span>
              </div>
            </div>

            <div style={{ width: "100%", border: "1px solid #E9EAEB", margin: "10px 0" }} />

            {/* Description */}
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>Description</span>
              <div
                style={{
                  color: "#414651",
                }}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(segmentOneValues.description) }}
              />
            </div>
          </CareerCollapseableContainer>

          <CareerCollapseableContainer containerTitle="AI Interview Setup" onEditClick={() => setCurrentStep(1)}>
            {/* AI Interview Screening */}
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>AI Interview Screening</span>

              {segmentTwoValues.screeningSetting === "Good Fit and above" ? (
                <span style={{ color: "#414651", fontWeight: 500 }}>
                  Automatically endorse candidates who are{" "}
                  <span
                    className="badge"
                    style={{ fontSize: 14, border: "1px solid #B2DDFF", color: "#175CD3", backgroundColor: "#EFF8FF", borderRadius: "25px", padding: "5px 10px", textTransform: "capitalize" }}
                  >
                    Good Fit
                  </span>{" "}
                  and above
                </span>
              ) : segmentTwoValues.screeningSetting === "Only Strong Fit" ? (
                <span style={{ color: "#414651", fontWeight: 500 }}>
                  Automatically endorse candidates who are{" "}
                  <span
                    className="badge"
                    style={{ fontSize: 14, border: "1px solid #A6F4C5", color: "#027948", backgroundColor: "#ECFDF3", borderRadius: "25px", padding: "5px 10px", textTransform: "capitalize" }}
                  >
                    Strong Fit
                  </span>{" "}
                  only
                </span>
              ) : (
                <span style={{ color: "#414651", fontWeight: 500 }}>No automatic endorsements for candidates</span>
              )}
            </div>

            <div style={{ width: "100%", border: "1px solid #E9EAEB", margin: "10px 0" }} />

            {/* Require Video on Interview */}
            <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>Require Video on Interview</span>
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "10px" }}>
                <span style={{ color: "#414651", fontWeight: 500 }}>{segmentTwoValues.requireVideo ? "Yes" : "No"}</span>
                <i
                  className={segmentTwoValues.requireVideo ? "la la-check" : "la la-times"}
                  style={{
                    fontSize: 15,
                    color: segmentTwoValues.requireVideo ? "#12B76A" : "#C01048",
                    padding: "8px",
                    border: segmentTwoValues.requireVideo ? "1px solid #A6F4C5" : "1px solid #FECCD6",
                    borderRadius: "100%",
                    backgroundColor: segmentTwoValues.requireVideo ? "#ECFDF3" : "#FFF1F3",
                  }}
                />
              </div>
            </div>

            <div style={{ width: "100%", border: "1px solid #E9EAEB", margin: "10px 0" }} />

            {/* Interview Questions */}
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>Interview Questions</span>

                <div
                  style={{
                    borderRadius: "45%",
                    width: 35,
                    height: 28,
                    border: "1px solid #D5D9EB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    backgroundColor: "#F8F9FC",
                    color: "#363F72",
                    fontWeight: 700,
                  }}
                >
                  {segmentTwoValues.questions.reduce((acc, group) => acc + group.questions.length, 0)}
                </div>
              </div>

              {segmentTwoValues.questions.map((category) => (
                <div key={category.id}>
                  <span style={{ fontSize: 16, color: "#414651", fontWeight: 700, marginBottom: 5 }}>{category.category}</span>
                  <ol style={{ listStyleType: "none", paddingLeft: 16, margin: "5px 0", display: "flex", flexDirection: "column", gap: "5px" }}>
                    {category.questions.map((q) => {
                      const currentNumber = questionNumber++;
                      return (
                        <li key={q.id} style={{ fontSize: 16, color: "#414651", fontWeight: 500 }}>
                          {currentNumber}. {q.question}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>
          </CareerCollapseableContainer>
        </CareerFormMainContainer>
      )}

      {/* CAREER ACTION MODAL */}
      {showSaveModal && (
        <CareerActionModal
          action={showSaveModal}
          onAction={(action) => {
            // If this career already exists (either passed in or created earlier), update instead of creating another
            if (career?._id || savedCareerId) {
              updateCareer(action);
            } else {
              saveCareer(action);
            }
          }}
        />
      )}

      {/* SAVING LOADING ANIMATION */}
      {isSavingCareer && (
        <FullScreenLoadingAnimation
          title={formType === "add" ? "Saving career..." : "Updating career..."}
          subtext={`Please wait while we are ${formType === "add" ? "saving" : "updating"} the career`}
        />
      )}
    </div>
  );
}

// ===================== COMPONENTS =====================
interface Step {
  title: string;
  hasError?: boolean;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
}

const StepSegment: React.FC<{
  title: string;
  isCompleted: boolean;
  isActive: boolean;
  hasError: boolean;
  progress: number;
  showProgressBar: boolean;
}> = ({ title, isCompleted, isActive, hasError, progress, showProgressBar }) => {
  // Getter Functions
  const getIconColor = () => {
    if (hasError) return "#F04438";
    if (isActive) return "#181D27";
    if (isCompleted) return "#181D27";
    return "#D5D7DA";
  };

  const getIconClass = () => {
    if (hasError) return "la la-exclamation-circle";
    if (isCompleted) return "la la-check-circle";
    return "la la-dot-circle";
  };

  const getLabelColor = () => {
    if (hasError) return "#F04438";
    if (isActive || isCompleted) return "#181D27";
    return "#717680";
  };

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      {/* ICON AND PROGRESS BAR */}
      <div style={{ width: "100%", display: "flex", flexDirection: "row", alignItems: "center", gap: "10px" }}>
        {/* ICON */}
        <i className={getIconClass()} style={{ color: getIconColor(), fontSize: 28 }} />

        {/* PROGRESS BAR (only show if not last segment) */}
        {showProgressBar && (
          <div
            style={{
              width: "100%",
              height: "5px",
              backgroundColor: "#E9EAEB",
              borderRadius: "60px",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: "linear-gradient(90deg, #9fcaed 0%, #ceb6da 33%, #ebacc9 66%, #fccec0 100%)",
                borderRadius: "60px",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        )}
      </div>

      {/* SEGMENT LABEL */}
      <div
        style={{
          padding: "0 5px",
        }}
      >
        <span style={{ fontSize: 16, color: getLabelColor(), fontWeight: 700, whiteSpace: "nowrap" }}>{title}</span>
      </div>
    </div>
  );
};

const Stepper: React.FC<StepperProps> = ({ steps, currentStep }) => {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: "2000px",
        margin: "0 auto",
        display: "grid",
        gridTemplateColumns: `repeat(${steps.length - 1}, 1fr) auto`,
        gap: "10px",
      }}
    >
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isActive = index === currentStep;
        const hasError = step.hasError || false;
        const showProgressBar = index < steps.length - 1;

        // Progress is 100% if completed, otherwise 0
        const progress = isCompleted ? 100 : 0;

        return <StepSegment key={index} title={step.title} isCompleted={isCompleted} isActive={isActive} hasError={hasError} progress={progress} showProgressBar={showProgressBar} />;
      })}
    </div>
  );
};

const CareerFormHeader: React.FC<{ title: string; children: React.ReactNode; isCareerInactive?: boolean }> = ({ title, children, isCareerInactive }) => {
  return (
    <div
      style={{
        marginBottom: "35px",
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
      }}
    >
      <h1 style={{ fontSize: "24px", fontWeight: 550, color: "#181D27" }}>
        {isCareerInactive && <span style={{ color: "#717680" }}>{"[Draft] "}</span>} {title}
      </h1>

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "10px",
        }}
      >
        {children}
      </div>
    </div>
  );
};

const CareerFormMainContainer: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => {
  return (
    <div
      style={cs(
        {
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          width: "100%",
          gap: "32px",
          marginBottom: "32px",
          maxWidth: "1556px",
          margin: "0 auto",
        },
        style
      )}
    >
      {children}
    </div>
  );
};

const CareerFormSectionContainer: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({ style, children }) => {
  return (
    <div
      style={cs(
        {
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "32px",
        },
        style
      )}
    >
      {children}
    </div>
  );
};

const CareerFormSubSectionContainer: React.FC<{ children: React.ReactNode; number?: number; title: string; iconComponent?: React.ReactNode }> = ({ children, number, title, iconComponent }) => {
  return (
    <div className="layered-card-middle">
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          padding: "5px 16px",
        }}
      >
        <span style={{ fontSize: 18, color: "#181D27", fontWeight: 700, display: "flex", flexDirection: "row", alignItems: "center", gap: "10px" }}>
          {iconComponent && iconComponent}
          {number ? `${number}. ` : ""}
          {title}
        </span>
      </div>

      <div className="layered-card-content" style={{ gap: "30px" }}>
        {children}
      </div>
    </div>
  );
};

const CareerFormTipsContainer: React.FC<{ tips: { highlightedText?: string; text: string }[] }> = ({ tips }) => {
  return (
    <div className="layered-card-middle">
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          padding: "5px 16px",
        }}
      >
        <span style={{ fontSize: 18, color: "#181D27", fontWeight: 700, display: "flex", flexDirection: "row", alignItems: "center", gap: "10px" }}>
          <img src={assetConstants.hilightV2} style={{ width: 23, height: 23 }} />
          Tips
        </span>
      </div>

      <div className="layered-card-content" style={{ gap: "12px" }}>
        {tips.map((tip, index) => (
          <span key={index} style={{ color: "#717680", fontWeight: 500, textAlign: "left" }}>
            <strong style={{ color: "#181D27", fontWeight: 700 }}>{tip.highlightedText} </strong>
            {tip.text}
          </span>
        ))}
      </div>
    </div>
  );
};

export const CareerActionButton: React.FC<{
  variant: "primary" | "secondary";
  disabled?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
  iconPosition?: "left" | "right";
  customStyle?: React.CSSProperties;
}> = ({ variant, disabled, onClick, icon, children, iconPosition = "left", customStyle }) => {
  const isPrimary = variant === "primary";
  const isDisabled = disabled;

  const baseStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: iconPosition === "left" ? "row" : "row-reverse",
    alignItems: "center",
    gap: icon ? 10 : 0,
    width: "fit-content",
    padding: "9px 20px",
    borderRadius: "60px",
    whiteSpace: "nowrap",
    border: "1px solid #D5D7DA",
    cursor: isDisabled ? "not-allowed" : "pointer",
    fontWeight: 500,
    fontSize: 16,
  };

  const variantStyle: React.CSSProperties = isPrimary
    ? {
        background: isDisabled ? "#D5D7DA" : "#181D27",
        color: "#fff",
        border: "1px solid #E9EAEB",
      }
    : {
        color: "#414651",
        background: "#fff",
      };

  return (
    <button className="btn" disabled={isDisabled} style={cs(baseStyle, variantStyle, customStyle)} onClick={onClick}>
      {icon}
      {children}
    </button>
  );
};

const CareerCollapseableContainer: React.FC<{
  children: React.ReactNode;
  containerTitle?: string;
  onEditClick?: () => void;
}> = ({ children, containerTitle, onEditClick }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="layered-card-middle">
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          padding: "5px 16px",
          cursor: "pointer",
          justifyContent: "space-between",
        }}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <span
          style={{
            fontSize: 18,
            color: "#181D27",
            fontWeight: 700,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <i
            className="la la-angle-down"
            style={{
              fontSize: 20,
              display: "inline-block",
              transition: "transform 0.3s ease",
              transform: isCollapsed ? "rotate(0deg)" : "rotate(-180deg)",
            }}
          />
          {containerTitle}
        </span>

        <button
          className="btn"
          style={{
            color: "#535862",
            background: "#fff",
            border: "1px solid #D5D7DA",
            borderRadius: "100%",
            width: 40,
            height: 41,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onEditClick?.();
          }}
        >
          <i className="la la-pencil" style={{ fontSize: 24 }} />
        </button>
      </div>

      {!isCollapsed && <div className="layered-card-content">{children}</div>}
    </div>
  );
};

// ===================== REUSABLE COMPONENTS =====================

const FormSection: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
    {title && <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>{title}</span>}
    {children}
  </div>
);

const FormField: React.FC<{ label: string; isError?: boolean; children: React.ReactNode }> = ({ label, isError, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
    <span style={{ color: isError ? "#F04438" : "#414651", fontWeight: 500 }}>{label}</span>
    {children}
  </div>
);

const FormToggle = ({ checked, onChange, label }) => (
  <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 8, minWidth: "130px" }}>
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="slider round" />
    </label>
    <span>{label}</span>
  </div>
);

const CurrencyInput: React.FC<{ value: string; onChange: (value: string) => void; placeholder?: string; isError?: boolean }> = ({ value, onChange, placeholder, isError }) => (
  <div style={{ position: "relative" }}>
    <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#6c757d", fontSize: "16px", pointerEvents: "none" }}>₱</span>
    <input
      type="number"
      className="form-control"
      style={{ paddingLeft: "28px", boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)", outline: isError ? "2px solid #FDA29B" : "none" }}
      placeholder={placeholder}
      min={0}
      value={value}
      onChange={(e) => onChange(e.target.value || "")}
    />
    <span style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", color: "#6c757d", fontSize: "16px", pointerEvents: "none", left: "auto", right: "30px" }}>PHP</span>
  </div>
);

// ===================== FORM VALIDATION =====================
interface ValidationRule {
  required?: boolean;
  message?: string;
}

function useCareerFormValidation<T extends Record<string, any>>(initialValues: T) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = useCallback((field: keyof T, value: any) => {
    setValues((prev) => ({ ...prev, [field]: value }));

    // Clear error if fixed
    setErrors((prev) => {
      if (value && prev[field as string]) {
        const updated = { ...prev };
        delete updated[field as string];
        return updated;
      }
      return prev;
    });
  }, []);

  const handleQuestionsChange = useCallback((updatedQuestions: any[]) => {
    setValues((prev) => ({ ...prev, questions: updatedQuestions }));

    const totalQuestions = updatedQuestions.reduce((acc, cat) => acc + (Array.isArray(cat.questions) ? cat.questions.length : 0), 0);

    setErrors((prev) => {
      if (totalQuestions >= 5 && prev["questions"]) {
        const updated = { ...prev };
        delete updated["questions"];
        return updated;
      }
      return prev;
    });
  }, []);

  const validate = useCallback(
    (rules: Record<keyof T, ValidationRule>) => {
      const newErrors: Record<string, string> = {};
      for (const field in rules) {
        const rule = rules[field];
        const value = values[field];
        if (rule.required && (!value || String(value).trim().length === 0)) {
          newErrors[field] = rule.message || `${field} is required`;
        }
      }
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    },
    [values]
  );

  const validateQuestions = useCallback(() => {
    // Count total questions across all categories
    const totalQuestions = values.questions.reduce((sum, category) => sum + (Array.isArray(category.questions) ? category.questions.length : 0), 0);

    if (totalQuestions < 5) {
      setErrors((prev) => ({
        ...prev,
        questions: "At least 5 questions are required in total.",
      }));
      return false;
    }

    // Clear previous question error if fixed
    setErrors((prev) => {
      const updated = { ...prev };
      delete updated["questions"];
      return updated;
    });

    return true;
  }, [values.questions]);

  return {
    values,
    setValues,
    errors,
    handleChange,
    validate,
    validateQuestions,
    handleQuestionsChange,
  };
}
