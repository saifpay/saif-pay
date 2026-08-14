const express = require("express");

const {
  initializeApp,
  cert
} = require("firebase-admin/app");

const {
  getFirestore,
  FieldValue
} = require("firebase-admin/firestore");

const {
  getAuth
} = require("firebase-admin/auth");

const bcrypt = require("bcryptjs");

/*
====================================================
   SAIF PAY SERVER
====================================================
*/

const app = express();

const PORT = process.env.PORT || 3000;


/*
====================================================
   Firebase Service Account
====================================================
*/

let serviceAccount;

try {

  serviceAccount =
    require("./serviceAccountKey.json");

} catch (error) {

  console.error("");
  console.error("====================================");
  console.error("Firebase Service Account Error");
  console.error("====================================");

  console.error(
    "لم يتم العثور على serviceAccountKey.json"
  );

  console.error(
    "تأكد أن الملف موجود داخل مجلد SAIF-PAY"
  );

  console.error("");

  process.exit(1);
}


/*
====================================================
   Firebase Admin Initialization
====================================================
*/

try {

  initializeApp({
    credential: cert(serviceAccount)
  });

  console.log(
    "Firebase Admin initialized successfully ✅"
  );

} catch (error) {

  console.error("");
  console.error(
    "Firebase Initialization Error:"
  );

  console.error(error);

  console.error("");

  process.exit(1);
}


/*
====================================================
   Firebase Database / Authentication
====================================================
*/

const db =
  getFirestore();

const auth =
  getAuth();


/*
====================================================
   Middleware
====================================================
*/

app.use(
  express.json()
);

app.use(
  express.static(__dirname)
);


/*
====================================================
   الصفحة الرئيسية
====================================================
*/

app.get("/", (req, res) => {

  res.json({

    success: true,

    message:
      "SAIF PAY Server يعمل بنجاح ✅",

    server:
      "SAIF PAY",

    port:
      PORT

  });

});


/*
====================================================
   فحص حالة السيرفر
====================================================
*/

app.get("/api/status", (req, res) => {

  res.json({

    success: true,

    message:
      "SAIF PAY Server يعمل بنجاح ✅",

    server:
      "SAIF PAY",

    port:
      PORT

  });

});


/*
====================================================
   التحقق من Firebase User
====================================================
*/

async function verifyUser(
  req,
  res,
  next
) {

  try {

    const authorization =
      req.headers.authorization || "";


    /*
    ----------------------------------------------
       التأكد من وجود Bearer Token
    ----------------------------------------------
    */

    if (
      !authorization.startsWith(
        "Bearer "
      )
    ) {

      return res.status(401).json({

        success: false,

        message:
          "غير مصرح بالدخول"

      });

    }


    /*
    ----------------------------------------------
       استخراج Firebase ID Token
    ----------------------------------------------
    */

    const token =
      authorization
        .substring(7)
        .trim();


    if (!token) {

      return res.status(401).json({

        success: false,

        message:
          "رمز الدخول غير موجود"

      });

    }


    /*
    ----------------------------------------------
       التحقق من Firebase Token
    ----------------------------------------------
    */

    const decodedToken =
      await auth.verifyIdToken(
        token
      );


    req.user =
      decodedToken;


    next();


  } catch (error) {

    console.error("");
    console.error(
      "Authentication Error:"
    );
    console.error(error);
    console.error("");

    return res.status(401).json({

      success: false,

      message:
        "جلسة المستخدم غير صالحة"

    });

  }

}


/*
====================================================
   بيانات المستخدم الحالي
====================================================
*/

app.get(
  "/api/me",
  verifyUser,
  async (req, res) => {

    try {

      const uid =
        req.user.uid;


      const userRef =
        db
          .collection("users")
          .doc(uid);


      const userSnap =
        await userRef.get();


      if (!userSnap.exists) {

        return res.status(404).json({

          success: false,

          message:
            "حساب المستخدم غير موجود"

        });

      }


      const userData =
        userSnap.data();


      return res.json({

        success: true,

        user: {

          uid:
            uid,

          fullName:
            userData.fullName || "",

          phone:
            userData.phone || "",

          email:
            userData.email || "",

          balance:
            Number(
              userData.balance || 0
            )

        }

      });


    } catch (error) {

      console.error(
        "ME Error:",
        error
      );


      return res.status(500).json({

        success: false,

        message:
          "حدث خطأ أثناء جلب بيانات المستخدم"

      });

    }

  }
);


/*
====================================================
   البحث عن مستخدم بواسطة رقم الهاتف
====================================================
*/

app.get(
  "/api/user/by-phone",
  verifyUser,
  async (req, res) => {

    try {

      const phone =
        String(
          req.query.phone || ""
        ).trim();


      if (!phone) {

        return res.status(400).json({

          success: false,

          message:
            "رقم الهاتف مطلوب"

        });

      }


      const snapshot =
        await db
          .collection("users")
          .where(
            "phone",
            "==",
            phone
          )
          .limit(1)
          .get();


      if (snapshot.empty) {

        return res.status(404).json({

          success: false,

          message:
            "لم يتم العثور على مستخدم بهذا الرقم"

        });

      }


      const userDoc =
        snapshot.docs[0];


      const userData =
        userDoc.data();


      return res.json({

        success: true,

        user: {

          uid:
            userDoc.id,

          fullName:
            userData.fullName || "",

          phone:
            userData.phone || "",

          email:
            userData.email || ""

        }

      });


    } catch (error) {

      console.error(
        "Find User Error:",
        error
      );


      return res.status(500).json({

        success: false,

        message:
          "حدث خطأ أثناء البحث عن المستخدم"

      });

    }

  }
);


/*
====================================================
   تحويل الأموال
====================================================
*/

app.post(
  "/api/transfer",
  verifyUser,
  async (req, res) => {

    try {

      /*
      ================================================
         بيانات المرسل
      ================================================
      */

      const senderUid =
        req.user.uid;


      /*
      ================================================
         بيانات الطلب
      ================================================
      */

      const {
        receiverUid,
        receiverPhone,
        amount,
        reason,
        pin,
        requestId
      } = req.body;


      /*
      ================================================
         حماية من تكرار نفس التحويل
      ================================================
      */

      const transferRequestId =
        String(
          requestId || ""
        ).trim();


      if (!transferRequestId) {

        return res.status(400).json({

          success: false,

          message:
            "معرف عملية التحويل مطلوب"

        });

      }


      if (
        transferRequestId.length < 10 ||
        transferRequestId.length > 100
      ) {

        return res.status(400).json({

          success: false,

          message:
            "معرف عملية التحويل غير صالح"

        });

      }


      /*
      ================================================
         التحقق من الرقم السري
      ================================================
      */

      if (
        pin === undefined ||
        pin === null ||
        String(pin).trim() === ""
      ) {

        return res.status(400).json({

          success: false,

          message:
            "الرقم السري مطلوب"

        });

      }


      /*
      ================================================
         التحقق من المبلغ
      ================================================
      */

      const transferAmount =
        Number(amount);


      if (
        !Number.isFinite(
          transferAmount
        ) ||
        transferAmount <= 0
      ) {

        return res.status(400).json({

          success: false,

          message:
            "المبلغ غير صالح"

        });

      }


      /*
      ================================================
         منع المبالغ العشرية الطويلة
      ================================================
      */

      if (
        !Number.isInteger(
          Math.round(
            transferAmount * 100
          )
        )
      ) {

        return res.status(400).json({

          success: false,

          message:
            "المبلغ غير صالح"

        });

      }


      /*
      ================================================
         مرجع حساب المرسل
      ================================================
      */

      const senderRef =
        db
          .collection("users")
          .doc(senderUid);


      /*
      ================================================
         مرجع طلب التحويل
      ================================================
      */

      const transferRequestRef =
        db
          .collection("transferRequests")
          .doc(
            transferRequestId
          );


      /*
      ================================================
         تحديد حساب المستلم
      ================================================
      */

      let receiverRef;


      if (receiverUid) {

        receiverRef =
          db
            .collection("users")
            .doc(
              String(
                receiverUid
              ).trim()
            );

      }

      else if (receiverPhone) {

        const phone =
          String(
            receiverPhone
          ).trim();


        const receiverQuery =
          await db
            .collection("users")
            .where(
              "phone",
              "==",
              phone
            )
            .limit(1)
            .get();


        if (
          receiverQuery.empty
        ) {

          return res.status(404).json({

            success: false,

            message:
              "لم يتم العثور على حساب المستلم"

          });

        }


        receiverRef =
          receiverQuery.docs[0].ref;

      }

      else {

        return res.status(400).json({

          success: false,

          message:
            "لم يتم تحديد المستلم"

        });

      }


      /*
      ================================================
         منع التحويل إلى النفس
      ================================================
      */

      if (
        senderUid ===
        receiverRef.id
      ) {

        return res.status(400).json({

          success: false,

          message:
            "لا يمكنك التحويل إلى حسابك"

        });

      }


      /*
      ================================================
         إنشاء رقم العملية
      ================================================
      */

      const transactionId =
        "TX-" +
        Date.now() +
        "-" +
        Math.random()
          .toString(36)
          .substring(2, 8)
          .toUpperCase();


      /*
      ================================================
         Firestore Transaction
      ================================================
      */

      const transactionResult =
        await db.runTransaction(
          async (transaction) => {

            /*
            ------------------------------------------
               فحص الطلب السابق
            ------------------------------------------
            */

            const requestSnap =
              await transaction.get(
                transferRequestRef
              );


            /*
            ------------------------------------------
               قراءة حساب المرسل
            ------------------------------------------
            */

            const senderSnap =
              await transaction.get(
                senderRef
              );


            /*
            ------------------------------------------
               قراءة حساب المستلم
            ------------------------------------------
            */

            const receiverSnap =
              await transaction.get(
                receiverRef
              );


            /*
            ------------------------------------------
               التأكد من وجود المرسل
            ------------------------------------------
            */

            if (
              !senderSnap.exists
            ) {

              throw new Error(
                "SENDER_NOT_FOUND"
              );

            }


            /*
            ------------------------------------------
               التأكد من وجود المستلم
            ------------------------------------------
            */

            if (
              !receiverSnap.exists
            ) {

              throw new Error(
                "RECEIVER_NOT_FOUND"
              );

            }


            /*
            ------------------------------------------
               إذا كان الطلب منفذ سابقًا
            ------------------------------------------
            */

            if (
              requestSnap.exists
            ) {

              const previousRequest =
                requestSnap.data();


              if (
                previousRequest.senderUid !==
                senderUid
              ) {

                throw new Error(
                  "REQUEST_ID_CONFLICT"
                );

              }


              return {

                transactionId:
                  previousRequest.transactionId,

                senderBalance:
                  Number(
                    previousRequest.senderBalance
                  ),

                receiverBalance:
                  Number(
                    previousRequest.receiverBalance
                  ),

                alreadyProcessed:
                  true

              };

            }


            /*
            ------------------------------------------
               بيانات المرسل والمستلم
            ------------------------------------------
            */

            const senderData =
              senderSnap.data();


            const receiverData =
              receiverSnap.data();


            /*
            ==========================================
               التحقق من الرقم السري
            ==========================================
            */

            const storedPin =
              String(
                senderData.pin || ""
              );


            let isPinValid =
              false;


            /*
            ------------------------------------------
               إذا كان PIN مشفرًا بـ bcrypt
            ------------------------------------------
            */

            if (
              storedPin.startsWith("$2")
            ) {

              isPinValid =
                await bcrypt.compare(
                  String(pin),
                  storedPin
                );

            }

            /*
            ------------------------------------------
               إذا كان PIN محفوظًا كنص عادي
            ------------------------------------------
            */

            else {

              isPinValid =
                storedPin ===
                String(pin);

            }


            if (!isPinValid) {

              throw new Error(
                "INVALID_PIN"
              );

            }


            /*
            ==========================================
               الرصيد الحالي للمرسل
            ==========================================
            */

            const senderBalance =
              Number(
                senderData.balance || 0
              );


            /*
            ==========================================
               الرصيد الحالي للمستلم
            ==========================================
            */

            const receiverBalance =
              Number(
                receiverData.balance || 0
              );


            /*
            ==========================================
               التحقق من صحة الرصيد
            ==========================================
            */

            if (
              !Number.isFinite(
                senderBalance
              )
            ) {

              throw new Error(
                "INVALID_SENDER_BALANCE"
              );

            }


            if (
              !Number.isFinite(
                receiverBalance
              )
            ) {

              throw new Error(
                "INVALID_RECEIVER_BALANCE"
              );

            }


            /*
            ==========================================
               التحقق من الرصيد الكافي
            ==========================================
            */

            if (
              senderBalance <
              transferAmount
            ) {

              throw new Error(
                "INSUFFICIENT_BALANCE"
              );

            }


            /*
            ==========================================
               الأرصدة الجديدة
            ==========================================
            */

            const newSenderBalance =
              senderBalance -
              transferAmount;


            const newReceiverBalance =
              receiverBalance +
              transferAmount;


            /*
            ==========================================
               تحديث رصيد المرسل
            ==========================================
            */

            transaction.update(
              senderRef,
              {

                balance:
                  newSenderBalance

              }
            );


            /*
            ==========================================
               تحديث رصيد المستلم
            ==========================================
            */

            transaction.update(
              receiverRef,
              {

                balance:
                  newReceiverBalance

              }
            );


            /*
            ==========================================
               إنشاء مستند العملية
            ==========================================
            */

            const transactionRef =
              db
                .collection(
                  "transactions"
                )
                .doc();


            transaction.set(
              transactionRef,
              {

                transactionId:
                  transactionId,

                from:
                  senderUid,

                to:
                  receiverRef.id,

                senderName:
                  senderData.fullName || "",

                senderPhone:
                  senderData.phone || "",

                receiverName:
                  receiverData.fullName || "",

                receiverPhone:
                  receiverData.phone || "",

                amount:
                  transferAmount,

                reason:
                  String(
                    reason || ""
                  ),

                type:
                  "transfer",

                status:
                  "completed",

                senderBalanceAfter:
                  newSenderBalance,

                receiverBalanceAfter:
                  newReceiverBalance,

                createdAt:
                  FieldValue.serverTimestamp()

              }
            );


            /*
            ==========================================
               حفظ Request ID
            ==========================================
            */

            transaction.set(
              transferRequestRef,
              {

                requestId:
                  transferRequestId,

                senderUid:
                  senderUid,

                receiverUid:
                  receiverRef.id,

                transactionId:
                  transactionId,

                senderBalance:
                  newSenderBalance,

                receiverBalance:
                  newReceiverBalance,

                createdAt:
                  FieldValue.serverTimestamp()

              }
            );


            /*
            ==========================================
               إشعار المرسل
            ==========================================
            */

            const senderNotificationRef =
              db
                .collection(
                  "notifications"
                )
                .doc();


            transaction.set(
              senderNotificationRef,
              {

                userId:
                  senderUid,

                type:
                  "transfer_sent",

                title:
                  "📤 تم إرسال حوالة",

                message:
                  `تم إرسال مبلغ $${transferAmount.toLocaleString(
                    "en-US"
                  )} إلى ${
                    receiverData.fullName ||
                    "المستلم"
                  }`,

                amount:
                  transferAmount,

                transactionId:
                  transactionId,

                read:
                  false,

                createdAt:
                  FieldValue.serverTimestamp()

              }
            );


            /*
            ==========================================
               إشعار المستلم
            ==========================================
            */

            const receiverNotificationRef =
              db
                .collection(
                  "notifications"
                )
                .doc();


            transaction.set(
              receiverNotificationRef,
              {

                userId:
                  receiverRef.id,

                type:
                  "transfer_received",

                title:
                  "💰 تم استلام حوالة",

                message:
                  `تم استلام مبلغ $${transferAmount.toLocaleString(
                    "en-US"
                  )} من ${
                    senderData.fullName ||
                    "المرسل"
                  }`,

                amount:
                  transferAmount,

                transactionId:
                  transactionId,

                read:
                  false,

                createdAt:
                  FieldValue.serverTimestamp()

              }
            );


            /*
            ==========================================
               إرجاع النتيجة
            ==========================================
            */

            return {

              transactionId:
                transactionId,

              senderBalance:
                newSenderBalance,

              receiverBalance:
                newReceiverBalance

            };

          }
        );


      /*
      ================================================
         نجاح التحويل
      ================================================
      */

      return res.json({

        success: true,

        message:
          "تم التحويل بنجاح ✅",

        transactionId:
          transactionResult.transactionId,

        balance:
          transactionResult.senderBalance

      });


    } catch (error) {

      console.error("");

      console.error(
        "===================================="
      );

      console.error(
        "Transfer Error:"
      );

      console.error(error);

      console.error(
        "===================================="
      );

      console.error("");


      /*
      ================================================
         الأخطاء المعروفة
      ================================================
      */

      if (
        error.message ===
        "SENDER_NOT_FOUND"
      ) {

        return res.status(404).json({

          success: false,

          message:
            "حساب المرسل غير موجود"

        });

      }


      if (
        error.message ===
        "RECEIVER_NOT_FOUND"
      ) {

        return res.status(404).json({

          success: false,

          message:
            "حساب المستلم غير موجود"

        });

      }


      if (
        error.message ===
        "REQUEST_ID_CONFLICT"
      ) {

        return res.status(409).json({

          success: false,

          message:
            "معرف عملية التحويل مستخدم لعملية أخرى"

        });

      }


      if (
        error.message ===
        "INVALID_PIN"
      ) {

        return res.status(400).json({

          success: false,

          message:
            "الرقم السري غير صحيح"

        });

      }


      if (
        error.message ===
        "INSUFFICIENT_BALANCE"
      ) {

        return res.status(400).json({

          success: false,

          message:
            "الرصيد غير كافٍ لإتمام التحويل"

        });

      }


      if (
        error.message ===
        "INVALID_SENDER_BALANCE"
      ) {

        return res.status(400).json({

          success: false,

          message:
            "رصيد المرسل غير صالح"

        });

      }


      if (
        error.message ===
        "INVALID_RECEIVER_BALANCE"
      ) {

        return res.status(400).json({

          success: false,

          message:
            "رصيد المستلم غير صالح"

        });

      }


      /*
      ================================================
         خطأ عام
      ================================================
      */

      return res.status(500).json({

        success: false,

        message:
          "حدث خطأ أثناء تنفيذ التحويل"

      });

    }

  }
);


/*
====================================================
   سجل عمليات المستخدم
====================================================
*/

app.get(
  "/api/transactions",
  verifyUser,
  async (req, res) => {

    try {

      const uid =
        req.user.uid;


      /*
      ----------------------------------------------
         العمليات المرسلة
      ----------------------------------------------
      */

      const sentSnapshot =
        await db
          .collection(
            "transactions"
          )
          .where(
            "from",
            "==",
            uid
          )
          .limit(50)
          .get();


      /*
      ----------------------------------------------
         العمليات المستلمة
      ----------------------------------------------
      */

      const receivedSnapshot =
        await db
          .collection(
            "transactions"
          )
          .where(
            "to",
            "==",
            uid
          )
          .limit(50)
          .get();


      const transactions = [];


      /*
      ----------------------------------------------
         إضافة العمليات المرسلة
      ----------------------------------------------
      */

      sentSnapshot.forEach(
        (doc) => {

          transactions.push({

            id:
              doc.id,

            ...doc.data()

          });

        }
      );


      /*
      ----------------------------------------------
         إضافة العمليات المستلمة
      ----------------------------------------------
      */

      receivedSnapshot.forEach(
        (doc) => {

          if (
            !transactions.some(
              (item) =>
                item.id === doc.id
            )
          ) {

            transactions.push({

              id:
                doc.id,

              ...doc.data()

            });

          }

        }
      );


      /*
      ----------------------------------------------
         ترتيب العمليات
      ----------------------------------------------
      */

      transactions.sort(
        (a, b) => {

          const aTime =
            a.createdAt &&
            a.createdAt.toMillis
              ? a.createdAt.toMillis()
              : 0;


          const bTime =
            b.createdAt &&
            b.createdAt.toMillis
              ? b.createdAt.toMillis()
              : 0;


          return bTime - aTime;

        }
      );


      return res.json({

        success: true,

        transactions:
          transactions

      });


    } catch (error) {

      console.error(
        "Transactions Error:",
        error
      );


      return res.status(500).json({

        success: false,

        message:
          "حدث خطأ أثناء جلب العمليات"

      });

    }

  }
);


/*
====================================================
   تشغيل الخادم
====================================================
*/

app.listen(
  PORT,
  () => {

    console.log("");

    console.log(
      "===================================="
    );

    console.log(
      "       SAIF PAY SERVER"
    );

    console.log(
      "===================================="
    );

    console.log(
      `Server running on http://localhost:${PORT}`
    );

    console.log(
      "Firebase: Connected ✅"
    );

    console.log(
      "===================================="
    );

    console.log("");

  }
);